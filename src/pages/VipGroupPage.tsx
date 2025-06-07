import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award } from 'lucide-react';

const VipGroupPage: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-100px)] bg-gray-100 p-4">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <Award className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
                    <CardTitle className="text-2xl font-bold text-primary">Grupo Vip</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-gray-700">Esta página é dedicada à gestão de Grupos Vip e está em construção. Volte em breve para novidades!</p>
                </CardContent>
            </Card>
        </div>
    );
};

export default VipGroupPage;