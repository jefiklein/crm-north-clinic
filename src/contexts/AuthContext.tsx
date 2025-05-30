import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
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
  clinicData: ClinicData | null; // A clínica atualmente selecionada
  availableClinics: ClinicData[] | null; // Todas as clínicas que o usuário pode acessar
  selectClinic: (clinicId: number | string) => void; // Função para selecionar uma clínica
  isLoadingAuth: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [clinicData, setClinicDataState] = useState<ClinicData | null>(null); // A clínica atualmente selecionada
  const [availableClinics, setAvailableClinics] = useState<ClinicData[] | null>(null); // Lista de clínicas disponíveis
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const navigate = useNavigate();

  // Função para atualizar clinicData e persistir no localStorage
  const setAndPersistClinicData = useCallback((data: ClinicData | null) => {
    console.log("[AuthContext] setAndPersistClinicData: Atualizando estado e localStorage com:", data);
    setClinicDataState(data);
    if (data) {
      localStorage.setItem('selectedClinicData', JSON.stringify(data)); // Chave diferente para a clínica selecionada
    } else {
      localStorage.removeItem('selectedClinicData');
    }
  }, []);

  // Função para selecionar uma clínica da lista de disponíveis
  const selectClinic = useCallback((clinicId: number | string) => {
    console.log("[AuthContext] selectClinic: Tentando selecionar clínica com ID:", clinicId);
    if (availableClinics) {
      const selected = availableClinics.find(c => String(c.id) === String(clinicId));
      if (selected) {
        setAndPersistClinicData(selected);
        showSuccess(`Clínica "${selected.nome}" selecionada.`);
        navigate('/dashboard'); // Redireciona para o dashboard após a seleção
      } else {
        showError("Clínica selecionada não encontrada ou não disponível.");
        console.error("[AuthContext] selectClinic: Clínica não encontrada na lista de disponíveis.", clinicId, availableClinics);
      }
    } else {
      showError("Lista de clínicas disponíveis não carregada.");
      console.error("[AuthContext] selectClinic: availableClinics é null.");
    }
  }, [availableClinics, setAndPersistClinicData, navigate]);


  useEffect(() => {
    console.log("[AuthContext] useEffect: Iniciando processo de autenticação...");

    const handleAuthSession = async (currentSession: Session | null) => {
      console.log("[AuthContext] handleAuthSession: Processando sessão:", currentSession);
      setSession(currentSession);

      if (currentSession?.user) {
        console.log("[AuthContext] handleAuthSession: Usuário presente. Buscando todas as clínicas vinculadas...");
        const userId = currentSession.user.id;

        try {
          // 1. Buscar TODAS as roles ativas do usuário
          console.log("[AuthContext] handleAuthSession: Buscando todas as roles ativas do usuário...");
          const { data: userRoles, error: rolesError } = await supabase
            .from('user_clinic_roles')
            .select('clinic_id, permission_level_id, is_active')
            .eq('user_id', userId)
            .eq('is_active', true); // Buscar todas as roles ativas

          if (rolesError) {
            console.error("[AuthContext] handleAuthSession: Erro ao buscar permissões do usuário:", rolesError);
            showError(`Erro ao buscar permissões: ${rolesError.message}`);
            setAvailableClinics(null);
            setAndPersistClinicData(null);
            navigate('/select-clinic');
            return;
          }

          if (userRoles && userRoles.length > 0) {
            console.log("[AuthContext] handleAuthSession: Roles encontradas:", userRoles);
            
            // Buscar detalhes de CADA clínica vinculada
            const clinicIds = userRoles.map(role => role.clinic_id);
            console.log("[AuthContext] handleAuthSession: IDs de clínicas para buscar detalhes:", clinicIds);

            const { data: clinicConfigs, error: clinicError } = await supabase
              .from('north_clinic_config_clinicas')
              .select('id, nome_da_clinica, authentication, id_permissao')
              .in('id', clinicIds) // Buscar todas as clínicas com esses IDs
              .eq('ativo', true); // Apenas clínicas ativas

            if (clinicError) {
              console.error("[AuthContext] handleAuthSession: Erro ao buscar configurações das clínicas:", clinicError);
              showError(`Erro ao buscar dados das clínicas: ${clinicError.message}`);
              setAvailableClinics(null);
              setAndPersistClinicData(null);
              navigate('/select-clinic');
              return;
            }

            const fetchedClinics: ClinicData[] = (clinicConfigs || []).map(config => {
                // Encontrar o nível de permissão correto para esta clínica
                const role = userRoles.find(r => r.clinic_id === config.id);
                return {
                    code: config.authentication || '',
                    nome: config.nome_da_clinica,
                    id: config.id,
                    id_permissao: role?.permission_level_id || 0, // Usar o nível de permissão da role
                };
            });
            console.log("[AuthContext] handleAuthSession: Clínicas disponíveis carregadas:", fetchedClinics);
            setAvailableClinics(fetchedClinics);

            // Lógica para definir a clínica atualmente selecionada
            const storedClinicData = localStorage.getItem('selectedClinicData');
            let selectedClinic: ClinicData | null = null;

            if (storedClinicData) {
              try {
                const parsedStoredData: ClinicData = JSON.parse(storedClinicData);
                // Verificar se a clínica armazenada ainda está na lista de clínicas disponíveis
                if (fetchedClinics.some(c => String(c.id) === String(parsedStoredData.id))) {
                  selectedClinic = parsedStoredData;
                  console.log("[AuthContext] handleAuthSession: Clínica selecionada do localStorage é válida:", selectedClinic);
                } else {
                  console.warn("[AuthContext] handleAuthSession: Clínica do localStorage não é mais válida. Limpando.");
                  localStorage.removeItem('selectedClinicData');
                }
              } catch (e) {
                console.error("[AuthContext] handleAuthSession: Erro ao analisar clinicData do localStorage", e);
                localStorage.removeItem('selectedClinicData');
              }
            }

            if (!selectedClinic && fetchedClinics.length === 1) {
              // Se não houver clínica selecionada e apenas uma disponível, seleciona automaticamente
              selectedClinic = fetchedClinics[0];
              console.log("[AuthContext] handleAuthSession: Apenas uma clínica disponível, selecionando automaticamente:", selectedClinic);
            }

            setAndPersistClinicData(selectedClinic); // Define a clínica selecionada (pode ser null)

            // Redirecionamento baseado no número de clínicas e seleção
            if (fetchedClinics.length > 1 && !selectedClinic) {
              console.log("[AuthContext] handleAuthSession: Múltiplas clínicas, redirecionando para seleção.");
              navigate('/select-clinic');
            } else if (fetchedClinics.length === 0) {
              console.warn("[AuthContext] handleAuthSession: Nenhuma clínica ativa encontrada para o usuário.");
              showError("Nenhuma clínica ativa encontrada para seu usuário.");
              navigate('/select-clinic');
            } else if (window.location.pathname === '/' || window.location.pathname.startsWith('/select-clinic')) {
              // Se já estiver no dashboard, não navega novamente para evitar loops
              // Se veio da tela de login ou seleção, vai para o dashboard
              navigate('/dashboard');
            }

          } else {
            console.warn("[AuthContext] handleAuthSession: Nenhuma role ativa encontrada para o usuário.");
            showError("Seu usuário não possui permissões ativas para nenhuma clínica.");
            setAvailableClinics([]); // Nenhuma clínica disponível
            setAndPersistClinicData(null);
            navigate('/select-clinic');
          }
        } catch (e: any) {
          console.error("[AuthContext] handleAuthSession: Erro inesperado durante o processamento da sessão:", e);
          showError(`Erro inesperado: ${e.message}`);
          setAvailableClinics(null);
          setAndPersistClinicData(null);
          navigate('/select-clinic');
        }
      } else {
        console.log("[AuthContext] handleAuthSession: Nenhuma sessão de usuário. Limpando dados da clínica e disponíveis.");
        setAvailableClinics(null);
        setAndPersistClinicData(null);
        // Se não houver sessão e não estiver na página de login ou select-clinic, redireciona
        if (window.location.pathname !== '/' && !window.location.pathname.startsWith('/select-clinic')) {
          navigate('/');
        }
      }
      setIsLoadingAuth(false); // Finaliza o carregamento da autenticação
    };

    // 2. Verifica a sessão atual do Supabase (estado definitivo)
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      console.log("[AuthContext] useEffect: getSession() inicial. Sessão:", initialSession);
      handleAuthSession(initialSession);
    }).catch(error => {
      console.error("[AuthContext] useEffect: Erro ao obter sessão inicial:", error);
      setIsLoadingAuth(false);
      setAvailableClinics(null);
      setAndPersistClinicData(null);
      navigate('/');
    });

    // 3. Monitora futuras mudanças de estado da autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      console.log("[AuthContext] onAuthStateChange: Evento:", event, "Sessão:", currentSession);
      if (event === 'SIGNED_OUT') {
        console.log("[AuthContext] onAuthStateChange: Usuário deslogado. Limpando dados da clínica e navegando para /.");
        setAvailableClinics(null);
        setAndPersistClinicData(null);
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
  }, [navigate, setAndPersistClinicData]); // Adiciona dependências para useCallback

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
    <AuthContext.Provider value={{ session, clinicData, availableClinics, selectClinic, isLoadingAuth, logout }}>
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