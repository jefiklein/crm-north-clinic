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
  acesso_crm: boolean;
  acesso_config_msg: boolean;
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
    setClinicDataState(data);
    if (data) {
      localStorage.setItem('clinicData', JSON.stringify(data));
    } else {
      localStorage.removeItem('clinicData');
    }
  };

  useEffect(() => {
    // Tenta carregar clinicData do localStorage ao iniciar
    const savedClinicData = localStorage.getItem('clinicData');
    if (savedClinicData) {
      try {
        setClinicDataState(JSON.parse(savedClinicData));
      } catch (e) {
        console.error("Failed to parse clinicData from localStorage", e);
        localStorage.removeItem('clinicData');
      }
    }

    // Monitora o estado da autenticação do Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log("Auth state changed:", event, currentSession);
      setSession(currentSession);
      setIsLoadingAuth(false);

      if (event === 'SIGNED_OUT') {
        setClinicData(null); // Limpa os dados da clínica ao deslogar
        navigate('/'); // Redireciona para a página de login
        showSuccess("Você foi desconectado.");
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        if (currentSession?.user) {
          console.log("User signed in/updated, fetching clinic data...");
          const userId = currentSession.user.id;

          // 1. Buscar roles do usuário
          const { data: userRoles, error: rolesError } = await supabase
            .from('user_clinic_roles')
            .select('clinic_id, permission_level_id, is_active')
            .eq('user_id', userId)
            .eq('is_active', true) // Apenas roles ativas
            .limit(1); // Por enquanto, pegamos a primeira role ativa

          if (rolesError) {
            console.error("Error fetching user roles:", rolesError);
            showError(`Erro ao buscar permissões: ${rolesError.message}`);
            setClinicData(null);
            navigate('/select-clinic'); // Redireciona para seleção/erro
            return;
          }

          if (userRoles && userRoles.length > 0) {
            const primaryRole = userRoles[0];
            const clinicId = primaryRole.clinic_id;
            const permissionLevel = primaryRole.permission_level_id;

            // 2. Buscar dados da clínica
            const { data: clinicConfig, error: clinicError } = await supabase
              .from('north_clinic_config_clinicas')
              .select('id, nome_da_clinica, authentication, acesso_crm, acesso_config_msg, id_permissao')
              .eq('id', clinicId)
              .eq('ativo', true) // Apenas clínicas ativas
              .single();

            if (clinicError) {
              console.error("Error fetching clinic config:", clinicError);
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
                acesso_crm: clinicConfig.acesso_crm,
                acesso_config_msg: clinicConfig.acesso_config_msg,
                id_permissao: permissionLevel, // Usar o nível de permissão da role
              };
              console.log("Clinic data fetched and set:", fetchedClinicData);
              setClinicData(fetchedClinicData);
              navigate('/dashboard'); // Redireciona para o dashboard após carregar a clínica
            } else {
              console.warn("No active clinic found for user's role.");
              showError("Nenhuma clínica ativa encontrada para seu usuário.");
              setClinicData(null);
              navigate('/select-clinic');
            }
          } else {
            console.warn("No active roles found for user.");
            showError("Seu usuário não possui permissões ativas para nenhuma clínica.");
            setClinicData(null);
            navigate('/select-clinic');
          }
        } else {
          // No user in session, clear clinic data and redirect to login
          setClinicData(null);
          navigate('/');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []); // Dependências vazias para rodar apenas uma vez na montagem

  const logout = async () => {
    setIsLoadingAuth(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error during logout:", error);
      showError(`Erro ao sair: ${error.message}`);
    } else {
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