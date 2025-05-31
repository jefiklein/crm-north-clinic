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

export const AuthProvider = ({ children, isPasswordUpdateFlow }: { children: ReactNode; isPasswordUpdateFlow: boolean }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [clinicData, setClinicDataState] = useState<ClinicData | null>(null); // A clínica atualmente selecionada
  const [availableClinics, setAvailableClinics] = useState<ClinicData[] | null>(null); // Lista de clínicas disponíveis
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const navigate = useNavigate(); // Keep navigate for logout

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
        navigate('/dashboard'); // This navigation is correct and desired
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

      try { // Adicionado bloco try para capturar erros e garantir finally
        if (currentSession?.user) {
          // NEW: Se estiver no fluxo de atualização de senha, não carregue dados da clínica
          if (isPasswordUpdateFlow) {
            console.log("[AuthContext] handleAuthSession: Em fluxo de atualização de senha. Pulando carregamento de dados da clínica.");
            setAvailableClinics(null); // Garante que não há clínicas disponíveis
            setAndPersistClinicData(null); // Garante que nenhuma clínica está selecionada
            return; // Sai da função, mas permite que isLoadingAuth seja false no finally
          }

          console.log("[AuthContext] handleAuthSession: Usuário presente. Buscando todas as clínicas vinculadas...");
          const userId = currentSession.user.id;

          const { data: userRoles, error: rolesError } = await supabase
            .from('user_clinic_roles')
            .select('clinic_id, permission_level_id, is_active')
            .eq('user_id', userId)
            .eq('is_active', true);

          if (rolesError) {
            console.error("[AuthContext] handleAuthSession: Erro ao buscar permissões do usuário:", rolesError);
            showError(`Erro ao buscar permissões: ${rolesError.message}`);
            setAvailableClinics(null);
            setAndPersistClinicData(null);
            return; // Retorna para que o finally seja executado
          }

          if (userRoles && userRoles.length > 0) {
            console.log("[AuthContext] handleAuthSession: Roles encontradas:", userRoles);
            
            const clinicIds = userRoles.map(role => role.clinic_id);
            const { data: clinicConfigs, error: clinicError } = await supabase
              .from('north_clinic_config_clinicas')
              .select('id, nome_da_clinica, authentication, id_permissao')
              .in('id', clinicIds)
              .eq('ativo', true);

            if (clinicError) {
              console.error("[AuthContext] handleAuthSession: Erro ao buscar configurações das clínicas:", clinicError);
              showError(`Erro ao buscar dados das clínicas: ${clinicError.message}`);
              setAvailableClinics(null);
              setAndPersistClinicData(null);
              return; // Retorna para que o finally seja executado
            }

            const fetchedClinics: ClinicData[] = (clinicConfigs || []).map(config => {
                const role = userRoles.find(r => r.clinic_id === config.id);
                return {
                    code: config.authentication || '',
                    nome: config.nome_da_clinica,
                    id: config.id,
                    id_permissao: role?.permission_level_id || 0,
                };
            });
            console.log("[AuthContext] handleAuthSession: Clínicas disponíveis carregadas:", fetchedClinics);
            setAvailableClinics(fetchedClinics);

            const storedClinicData = localStorage.getItem('selectedClinicData');
            let selectedClinic: ClinicData | null = null;

            if (storedClinicData) {
              try {
                const parsedStoredData: ClinicData = JSON.parse(storedClinicData);
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
              selectedClinic = fetchedClinics[0];
              console.log("[AuthContext] handleAuthSession: Apenas uma clínica disponível, selecionando automaticamente:", selectedClinic);
            }

            setAndPersistClinicData(selectedClinic); // Define a clínica selecionada (pode ser null)

            // REMOVE ALL NAVIGATION LOGIC FROM HERE.
            // App.tsx's ProtectedRoute and top-level Routes will handle navigation.

          } else {
            console.warn("[AuthContext] handleAuthSession: Nenhuma role ativa encontrada para o usuário.");
            showError("Seu usuário não possui permissões ativas para nenhuma clínica.");
            setAvailableClinics([]); // Define como array vazio para indicar que não há clínicas
            setAndPersistClinicData(null);
            // DO NOT navigate here. Let App.tsx handle it.
          }
        } else {
          console.log("[AuthContext] handleAuthSession: Nenhuma sessão de usuário. Limpando dados da clínica e disponíveis.");
          setAvailableClinics(null);
          setAndPersistClinicData(null);
          // DO NOT navigate here. Let App.tsx handle it.
        }
      } catch (e: any) {
        console.error("[AuthContext] handleAuthSession: Erro inesperado durante o processamento da sessão:", e);
        showError(`Erro inesperado: ${e.message}`);
        setAvailableClinics(null);
        setAndPersistClinicData(null);
      } finally {
        console.log("[AuthContext] handleAuthSession: Finalizando carregamento de autenticação (setIsLoadingAuth(false)).");
        setIsLoadingAuth(false); // Garante que o estado de carregamento seja sempre desativado
      }
    };

    // Initial session check
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      handleAuthSession(initialSession);
    }).catch(error => {
      console.error("[AuthContext] useEffect: Erro ao obter sessão inicial:", error);
      setIsLoadingAuth(false); // Garante que o estado de carregamento seja desativado mesmo em erro inicial
      setAvailableClinics(null);
      setAndPersistClinicData(null);
    });

    // Auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      console.log("[AuthContext] onAuthStateChange: Evento:", event, "Sessão:", currentSession);
      if (event === 'SIGNED_OUT') {
        console.log("[AuthContext] onAuthStateChange: Usuário deslogado. Limpando dados da clínica e navegando para /.");
        setAvailableClinics(null);
        setAndPersistClinicData(null);
        navigate('/'); // This is the only navigate that should remain here
        showSuccess("Você foi desconectado.");
        setIsLoadingAuth(false); // Garante que o estado de carregamento seja desativado ao deslogar
      } else {
        handleAuthSession(currentSession);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate, setAndPersistClinicData, isPasswordUpdateFlow]); // Adicionado isPasswordUpdateFlow como dependência

  // Diagnostic useEffect to log clinicData changes
  useEffect(() => {
    console.log("[AuthContext] clinicData state changed:", clinicData);
  }, [clinicData]);

  // Logout function
  const logout = useCallback(async () => {
    console.log("[AuthContext] logout: Iniciando logout...");
    setIsLoadingAuth(true); // Set loading true during logout process
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("[AuthContext] logout: Erro ao fazer logout:", error);
        showError(`Erro ao fazer logout: ${error.message}`);
      } else {
        console.log("[AuthContext] logout: Logout bem-sucedido.");
        // The onAuthStateChange listener will handle state clearing and navigation to '/'
      }
    } catch (e: any) {
      console.error("[AuthContext] logout: Erro inesperado durante o logout:", e);
      showError(`Erro inesperado ao fazer logout: ${e.message}`);
    } finally {
      setIsLoadingAuth(false); // Ensure loading is false after logout attempt
    }
  }, []);

  const value = {
    session,
    clinicData,
    availableClinics,
    selectClinic,
    isLoadingAuth,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};