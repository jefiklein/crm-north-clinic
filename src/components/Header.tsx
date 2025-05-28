import React from 'react';
import { LogOut } from 'lucide-react'; // Icon for logout
import { Button } from '@/components/ui/button'; // shadcn/ui Button

interface HeaderProps {
  clinicName: string;
  onLogout: () => void; // Define the prop type
}

export const Header: React.FC<HeaderProps> = ({ clinicName, onLogout }) => {
  return (
    <header className="flex items-center justify-between h-16 px-6 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
      <div className="flex items-center">
        {/* You can add a logo here if needed */}
        {/* <img src="/path/to/logo.png" alt="Logo" className="h-8 mr-3" /> */}
        <h1 className="text-xl font-semibold text-primary">
          North CRM {clinicName ? `- ${clinicName}` : ''}
        </h1>
      </div>
      <div className="user-actions">
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