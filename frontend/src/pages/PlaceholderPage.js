import React from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Construction } from 'lucide-react';

export const PlaceholderPage = ({ title, icon: Icon = Construction }) => {
  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <Card className="bg-[#18181B] border-zinc-800">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="text-white">{title}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="p-8 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 text-center">
              <Construction className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Página en Construcción</h3>
              <p className="text-zinc-400 max-w-md mx-auto">
                Esta página es una plantilla preparada para que puedas añadir funcionalidades 
                según las necesidades de tu aplicación.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};
