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
  // acesso_crm: boolean; // Removido
  // acesso_config_msg: boolean; // Removido
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

export const AuthProvider = ({ children }: { ReactNode }) => {
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
    console.log("[AuthContext] useEffect: Iniciando...");
    // Tenta carregar clinicData do localStorage ao iniciar
    const savedClinicData = localStorage.getItem('clinicData');
    if (savedClinicData) {
      try {
        const parsedData = JSON.parse(savedClinicData);
        console.log("[AuthContext] useEffect: clinicData carregado do localStorage:", parsedData);
        setClinicDataState(parsedData);
      } catch (e) {
        console.error("[AuthContext] useEffect: Falha ao analisar clinicData do localStorage", e);
        localStorage.removeItem('clinicData');
      }
    }

    // Monitora o estado da autenticação do Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log("[AuthContext] onAuthStateChange: Evento:", event, "Sessão:", currentSession);
      setSession(currentSession);
      setIsLoadingAuth(false);

      if (event === 'SIGNED_OUT') {
        console.log("[AuthContext] onAuthStateChange: Usuário deslogado. Limpando dados da clínica e navegando para /.");
        setClinicData(null); // Limpa os dados da clínica ao deslogar
        navigate('/'); // Redireciona para a página de login
        showSuccess("Você foi desconectado.");
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        if (currentSession?.user) {
          console.log("[AuthContext] onAuthStateChange: Usuário logado/atualizado. Buscando dados da clínica...");
          const userId = currentSession.user.id;
          console.log("[AuthContext] onAuthStateChange: User ID:", userId);

          // 1. Buscar roles do usuário
          console.log("[AuthContext] onAuthStateChange: Preparando para buscar roles do usuário... (Querying user_clinic_roles)");
          let userRoles = null;
          let rolesError = null;
          try {
            ({ data: userRoles, error: rolesError } = await supabase
              .from('user_clinic_roles')
              .select('clinic_id, permission_level_id, is_active')
              .eq('user_id', userId)
              .eq('is_active', true) // Apenas roles ativas
              .limit(1)); // Por enquanto, pegamos a primeira role ativa
          } catch (e: any) {
            console.error("[AuthContext] onAuthStateChange: ERRO CAPTURADO na busca de roles:", e.message, e);
            rolesError = e; // Atribui o erro capturado
          }

          console.log("[AuthContext] onAuthStateChange: Resultado da busca de roles - data:", userRoles, "error:", rolesError);

          if (rolesError) {
            console.error("[AuthContext] onAuthStateChange: Erro ao buscar permissões do usuário:", rolesError);
            showError(`Erro ao buscar permissões: ${rolesError.message}`);
            setClinicData(null);
            navigate('/select-clinic'); // Redireciona para seleção/erro
            return;
          }

          if (userRoles && userRoles.length > 0) {
            const primaryRole = userRoles[0];
            const clinicId = primaryRole.clinic_id;
            const permissionLevel = primaryRole.permission_level_id;
            console.log("[AuthContext] onAuthStateChange: Role encontrada. Clinic ID:", clinicId, "Nível de Permissão:", permissionLevel);

            // 2. Buscar dados da clínica
            console.log("[AuthContext] onAuthStateChange: Buscando dados da clínica com ID:", clinicId);
            const { data: clinicConfig, error: clinicError } = await supabase
              .from('north_clinic_config_clinicas')
              .select('id, nome_da_clinica, authentication, id_permissao') // Removido acesso_crm, acesso_config_msg
              .eq('id', clinicId)
              .eq('ativo', true) // Apenas clínicas ativas
              .single();

            console.log("[AuthContext] onAuthStateChange: Resultado da busca de config da clínica - data:", clinicConfig, "error:", clinicError);

            if (clinicError) {
              console.error("[AuthContext] onAuthStateChange: Erro ao buscar configuração da clínica:", clinicError);
              showError(`Erro ao buscar dados da clínica: ${clinicError.message}`);
              setClinicData(null);
              navigate('/select-clinic');
              return;
            }

            if (clinicConfig) {
              const fetchedClinicData: ClinicData = {
                code: clinicConfig.authentication || '', // Usar 'authentication' como 'code'
                nome: clinicConfig.nome_da_clinica,
                id: clinicConfig.id,
                // acesso_crm: clinicConfig.acesso_crm, // Removido
                // acesso_config_msg: clinicConfig.acesso_config_msg, // Removido
                id_permissao: permissionLevel, // Usar o nível de permissão da role
              };
              console.log("[AuthContext] onAuthStateChange: Dados da clínica carregados e definidos:", fetchedClinicData);
              setClinicData(fetchedClinicData);
              navigate('/dashboard'); // Redireciona para o dashboard após carregar a clínica
            } else {
              console.warn("[AuthContext] onAuthStateChange: Nenhuma clínica ativa encontrada para a role do usuário.");
              showError("Nenhuma clínica ativa encontrada para seu usuário.");
              setClinicData(null);
              navigate('/select-clinic');
            }
          } else {
            console.warn("[AuthContext] onAuthStateChange: Nenhuma role ativa encontrada para o usuário.");
            showError("Seu usuário não possui permissões ativas para nenhuma clínica.");
            setClinicData(null);
            navigate('/select-clinic');
          }
        } else {
          // No user in session, clear clinic data and redirect to login
          console.log("[AuthContext] onAuthStateChange: Nenhuma sessão de usuário. Limpando dados da clínica e navegando para /.");
          setClinicData(null);
          navigate('/');
        }
      }
    });

    return () => {
      console.log("[AuthContext] useEffect: Desinscrevendo do onAuthStateChange.");
      subscription.unsubscribe();
    };
  }, []); // Dependências vazias para rodar apenas uma vez na montagem

  const logout = async () => {
    console.log("[AuthContext] logout: Iniciando logout...");
    setIsLoadingAuth(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("[AuthContext] logout: Erro durante o logout:", error);
      showError(`Erro ao sair: ${error.message}`);
    } else {
      console.log("[AuthContext] logout: Logout bem-sucedido (onAuthStateChange cuidará do resto).");
      // O onAuthStateChange cuidará de limpar o estado e navegar
    }
    setIsLoadingAuth(false);
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