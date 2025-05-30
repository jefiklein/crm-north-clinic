import React from 'react';
import { LogOut, Building } from 'lucide-react'; // Icon for logout, added Building
import { Button } from '@/components/ui/button'; // shadcn/ui Button
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth
import { useNavigate } from 'react-router-dom'; // Import useNavigate

interface HeaderProps {
  // clinicName: string; // clinicName will now come from clinicData in AuthContext
  onLogout: () => void; // Define the prop type
}

export const Header: React.FC<HeaderProps> = ({ onLogout }) => {
  const { clinicData, availableClinics } = useAuth(); // Get clinicData and availableClinics
  const navigate = useNavigate();

  const showClinicSwitcher = availableClinics && availableClinics.length > 1;

  return (
    <header className="flex items-center justify-between h-16 px-6 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
      <div className="flex items-center">
        {/* You can add a logo here if needed */}
        {/* <img src="/path/to/logo.png" alt="Logo" className="h-8 mr-3" /> */}
        <h1 className="text-xl font-semibold text-primary">
          North CRM {clinicData?.nome ? `- ${clinicData.nome}` : ''}
        </h1>
      </div>
      <div className="user-actions flex items-center gap-2">
        {showClinicSwitcher && (
            <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/select-clinic')}
                title="Trocar Clínica"
            >
                <Building className="h-5 w-5 text-primary hover:text-blue-600" />
            </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onLogout} // Use the onLogout prop here
          title="Sair"
        >
          <LogOut className="h-5 w-5 text-primary hover:text-destructive" />
        </Button>
      </div>
    </header>
  );
};