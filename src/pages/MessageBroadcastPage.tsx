import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Megaphone } from 'lucide-react';

const MessageBroadcastPage: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-100px)] bg-gray-100 p-4">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <Megaphone className="mx-auto h-12 w-12 text-blue-500 mb-4" />
                    <CardTitle className="text-2xl font-bold text-primary">Disparo de Mensagens</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-gray-700">Esta página será para o disparo de mensagens em massa e está em construção. Fique ligado para as atualizações!</p>
                </CardContent>
            </Card>
        </div>
    );
};

export default MessageBroadcastPage;