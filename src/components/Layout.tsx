import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar'; // We will create this next
import { Header } from './Header'; // We will create this next

interface LayoutProps {
  onLogout: () => void; // Define the prop type
}

// This component provides the basic layout structure: Sidebar + Header + Content Area
const Layout: React.FC<LayoutProps> = ({ onLogout }) => { // Accept the prop
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Wrapper */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <Header onLogout={onLogout} /> {/* Pass the prop to Header */}

        {/* Content Area - This is where nested routes will render */}
        <main className="flex-1 overflow-y-auto bg-gray-100 p-4">
          <Outlet /> {/* Renders the matched nested route component */}
        </main>
      </div>
    </div>
  );
};

export default Layout;