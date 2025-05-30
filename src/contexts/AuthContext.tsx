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
        // Se o usuário logou ou atualizou, verifica se já tem uma clínica selecionada
        // Se não tiver, ou se a clínica selecionada não for mais válida, redireciona para seleção
        if (!clinicData || !clinicData.id) { // clinicData aqui é o estado atual, pode não ter sido atualizado pelo localStorage ainda
            const storedClinicData = localStorage.getItem('clinicData');
            if (!storedClinicData) {
                navigate('/select-clinic'); // Redireciona para a seleção de clínica
            } else {
                try {
                    const parsedData = JSON.parse(storedClinicData);
                    if (!parsedData.id) {
                        navigate('/select-clinic');
                    }
                } catch (e) {
                    console.error("Failed to parse stored clinic data on SIGNED_IN", e);
                    navigate('/select-clinic');
                }
            }
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