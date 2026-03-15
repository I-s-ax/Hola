import React from 'react';
import { Shield } from 'lucide-react';

const AUTH_BG_IMAGE = "https://images.unsplash.com/photo-1764258559791-06664419fa03?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHwyfHxhYnN0cmFjdCUyMGRhcmslMjB0ZWNobm9sb2d5JTIwZ3JhZGllbnQlMjBiYWNrZ3JvdW5kJTIwbWluaW1hbGlzdHxlbnwwfHx8fDE3NzM2MDMzMjh8MA&ixlib=rb-4.1.0&q=85";

export const AuthLayout = ({ children, title, subtitle }) => {
  return (
    <div className="min-h-screen bg-[#09090B] flex">
      {/* Left Panel - Hidden on mobile */}
      <div className="hidden lg:flex lg:w-[35%] relative overflow-hidden">
        <img 
          src={AUTH_BG_IMAGE} 
          alt="Abstract background" 
          className="absolute inset-0 w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-transparent to-transparent" />
        <div className="relative z-10 flex flex-col justify-end p-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-semibold text-white">AuthTemplate</span>
          </div>
          <blockquote className="text-lg text-zinc-400 italic">
            "Autenticación segura y elegante para tu aplicación."
          </blockquote>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 hero-glow">
        <div className="w-full max-w-[420px]">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-semibold text-white">AuthTemplate</span>
          </div>

          {/* Title */}
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">{title}</h1>
            {subtitle && <p className="text-zinc-400">{subtitle}</p>}
          </div>

          {/* Form Content */}
          <div className="glass-card rounded-xl p-6 sm:p-8 card-shadow">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
