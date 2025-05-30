import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { showSuccess, showError } from '@/utils/toast';

// Define a estrutura para os dados da clínica que serão armazenados no contexto
interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  id_permissao: number; // Permissão do usuário para esta clínica
}

interface AuthContextType {
  session: Session | null;
  clinicData: ClinicData | null;
  setClinicData: (data: ClinicData | null) => void;
  isLoadingAuth: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [clinicData, setClinicDataState] = useState<ClinicData | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const navigate = useNavigate();

  // Função para atualizar clinicData e persistir no localStorage
  const setClinicData = (data: ClinicData | null) => {
    console.log("[AuthContext] setClinicData: Atualizando estado e localStorage com:", data);
    setClinicDataState(data);
    if (data) {
      localStorage.setItem('clinicData', JSON.stringify(data));
    } else {
      localStorage.removeItem('clinicData');
    }
  };

  useEffect(() => {
    console.log("[AuthContext] useEffect: Iniciando processo de autenticação...");

    const handleAuthSession = async (currentSession: Session | null) => {
      console.log("[AuthContext] handleAuthSession: Processando sessão:", currentSession);
      setSession(currentSession);

      if (currentSession?.user) {
        console.log("[AuthContext] handleAuthSession: Usuário presente. Buscando dados da clínica...");
        const userId = currentSession.user.id;

        try {
          // 1. Buscar roles do usuário
          console.log("[AuthContext] handleAuthSession: Buscando roles do usuário...");
          const { data: userRoles, error: rolesError } = await supabase
            .from('user_clinic_roles')
            .select('clinic_id, permission_level_id, is_active')
            .eq('user_id', userId)
            .eq('is_active', true)
            .limit(1);

          if (rolesError) {
            console.error("[AuthContext] handleAuthSession: Erro ao buscar permissões do usuário:", rolesError);
            showError(`Erro ao buscar permissões: ${rolesError.message}`);
            setClinicData(null);
            navigate('/select-clinic');
            return;
          }

          if (userRoles && userRoles.length > 0) {
            const primaryRole = userRoles[0];
            const clinicId = primaryRole.clinic_id;
            const permissionLevel = primaryRole.permission_level_id;
            console.log("[AuthContext] handleAuthSession: Role encontrada. Clinic ID:", clinicId, "Nível de Permissão:", permissionLevel);

            // 2. Buscar dados da clínica
            console.log("[AuthContext] handleAuthSession: Buscando dados da clínica com ID:", clinicId);
            const { data: clinicConfig, error: clinicError } = await supabase
              .from('north_clinic_config_clinicas')
              .select('id, nome_da_clinica, authentication, id_permissao')
              .eq('id', clinicId)
              .eq('ativo', true)
              .single();

            if (clinicError) {
              console.error("[AuthContext] handleAuthSession: Erro ao buscar configuração da clínica:", clinicError);
              showError(`Erro ao buscar dados da clínica: ${clinicError.message}`);
              setClinicData(null);
              navigate('/select-clinic');
              return;
            }

            if (clinicConfig) {
              const fetchedClinicData: ClinicData = {
                code: clinicConfig.authentication || '',
                nome: clinicConfig.nome_da_clinica,
                id: clinicConfig.id,
                id_permissao: permissionLevel,
              };
              console.log("[AuthContext] handleAuthSession: Dados da clínica carregados e definidos:", fetchedClinicData);
              setClinicData(fetchedClinicData);
              // Se já estiver no dashboard, não navega novamente para evitar loops
              if (window.location.pathname === '/' || window.location.pathname.startsWith('/select-clinic')) {
                navigate('/dashboard');
              }
            } else {
              console.warn("[AuthContext] handleAuthSession: Nenhuma clínica ativa encontrada para a role do usuário.");
              showError("Nenhuma clínica ativa encontrada para seu usuário.");
              setClinicData(null);
              navigate('/select-clinic');
            }
          } else {
            console.warn("[AuthContext] handleAuthSession: Nenhuma role ativa encontrada para o usuário.");
            showError("Seu usuário não possui permissões ativas para nenhuma clínica.");
            setClinicData(null);
            navigate('/select-clinic');
          }
        } catch (e: any) {
          console.error("[AuthContext] handleAuthSession: Erro inesperado durante o processamento da sessão:", e);
          showError(`Erro inesperado: ${e.message}`);
          setClinicData(null);
          navigate('/select-clinic');
        }
      } else {
        console.log("[AuthContext] handleAuthSession: Nenhuma sessão de usuário. Limpando dados da clínica.");
        setClinicData(null);
        // Se não houver sessão e não estiver na página de login ou select-clinic, redireciona
        if (window.location.pathname !== '/' && !window.location.pathname.startsWith('/select-clinic')) {
          navigate('/');
        }
      }
      setIsLoadingAuth(false); // Finaliza o carregamento da autenticação
    };

    // 1. Tenta carregar clinicData do localStorage (estado provisório)
    const savedClinicData = localStorage.getItem('clinicData');
    if (savedClinicData) {
      try {
        const parsedData = JSON.parse(savedClinicData);
        console.log("[AuthContext] useEffect: clinicData carregado do localStorage (provisório):", parsedData);
        setClinicDataState(parsedData);
      } catch (e) {
        console.error("[AuthContext] useEffect: Falha ao analisar clinicData do localStorage", e);
        localStorage.removeItem('clinicData');
      }
    }

    // 2. Verifica a sessão atual do Supabase (estado definitivo)
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      console.log("[AuthContext] useEffect: getSession() inicial. Sessão:", initialSession);
      handleAuthSession(initialSession);
    }).catch(error => {
      console.error("[AuthContext] useEffect: Erro ao obter sessão inicial:", error);
      setIsLoadingAuth(false);
      setClinicData(null);
      navigate('/');
    });

    // 3. Monitora futuras mudanças de estado da autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      console.log("[AuthContext] onAuthStateChange: Evento:", event, "Sessão:", currentSession);
      if (event === 'SIGNED_OUT') {
        console.log("[AuthContext] onAuthStateChange: Usuário deslogado. Limpando dados da clínica e navegando para /.");
        setClinicData(null);
        navigate('/');
        showSuccess("Você foi desconectado.");
        setIsLoadingAuth(false); // Garante que o estado de carregamento seja falso após o logout
      } else {
        // Para SIGNED_IN, USER_UPDATED, etc., reprocessa a sessão
        handleAuthSession(currentSession);
      }
    });

    return () => {
      console.log("[AuthContext] useEffect: Desinscrevendo do onAuthStateChange.");
      subscription.unsubscribe();
    };
  }, []); // Dependências vazias para rodar apenas uma vez na montagem

  // NEW: Diagnostic useEffect to test direct Supabase queries for funnels and stages
  useEffect(() => {
    if (clinicData) {
      const testSupabaseQueries = async () => {
        console.log("[AuthContext - DIAGNOSTIC] Testing direct query for north_clinic_crm_funil...");
        const { data: funnelsTest, error: funnelsTestError } = await supabase
          .from('north_clinic_crm_funil')
          .select('*');
        console.log("[AuthContext - DIAGNOSTIC] north_clinic_crm_funil result:", { data: funnelsTest, error: funnelsTestError });

        console.log("[AuthContext - DIAGNOSTIC] Testing direct query for north_clinic_crm_etapa...");
        const { data: stagesTest, error: stagesTestError } = await supabase
          .from('north_clinic_crm_etapa')
          .select('*');
        console.log("[AuthContext - DIAGNOSTIC] north_clinic_crm_etapa result:", { data: stagesTest, error: stagesTestError });
      };
      testSupabaseQueries();
    }
  }, [clinicData]); // Run this effect when clinicData is available

  const logout = async () => {
    console.log("[AuthContext] logout: Iniciando logout...");
    setIsLoadingAuth(true); // Define como carregando durante o logout
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("[AuthContext] logout: Erro durante o logout:", error);
      showError(`Erro ao sair: ${error.message}`);
    } else {
      console.log("[AuthContext] logout: Logout bem-sucedido (onAuthStateChange cuidará do resto).");
      // O onAuthStateChange cuidará de limpar o estado e navegar
    }
    // setIsLoadingAuth(false); // onAuthStateChange já define isso
  };

  return (
    <AuthContext.Provider value={{ session, clinicData, setClinicData, isLoadingAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};