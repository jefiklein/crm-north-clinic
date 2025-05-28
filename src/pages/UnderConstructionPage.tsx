import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench } from 'lucide-react'; // Icon for under construction

const UnderConstructionPage: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-100px)] bg-gray-100 p-4"> {/* Adjusted height to account for header */}
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <Wrench className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
                    <CardTitle className="text-2xl font-bold text-primary">Em Construção</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-gray-700">Esta página ainda está sendo construída. Volte mais tarde!</p>
                </CardContent>
            </Card>
        </div>
    );
};

export default UnderConstructionPage;