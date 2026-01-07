
import React from 'react';
import { User, UserRole } from '../types';
import { LogOut, User as UserIcon, Bell, Menu } from 'lucide-react';

interface NavbarProps {
  user: User;
  onLogout: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ user, onLogout }) => {
  return (
    <nav className="bg-white border-b sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
            Q
          </div>
          <span className="text-xl font-bold tracking-tight hidden sm:inline-block">QR-Attend</span>
        </div>

        <div className="flex items-center gap-4">
          <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
            <Bell size={20} />
          </button>
          
          <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-800 leading-none">{user.name}</p>
              <p className="text-xs text-slate-500 mt-1 capitalize">{user.role.toLowerCase()}</p>
            </div>
            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 border border-slate-200">
              <UserIcon size={20} />
            </div>
            <button 
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
