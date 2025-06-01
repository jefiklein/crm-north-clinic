import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationLink, PaginationNext } from "@/components/ui/pagination";
import { Search, Plus, User, Info, TriangleAlert, Loader2, UserPlus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Define the structure for clinic data
interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  id_permissao: number;
}

// Define the structure for permission levels
interface PermissionLevel {
    id: number;
    name: string;
    description: string | null;
}

// Define the structure for a user item fetched from Supabase
interface SupabaseUser {
    id: string; // UUID
    email: string;
    first_name: string | null;
    last_name: string | null;
    created_at: string; // ISO timestamp
    user_clinic_roles: {
        id: number;
        clinic_id: number;
        permission_level_id: number;
        is_active: boolean;
        permission_levels: {
            name: string;
            description: string | null;
        } | null;
    }[];
}

interface UserListPageProps {
    clinicData: ClinicData | null;
}

const REQUIRED_PERMISSION_LEVEL = 4; // Nível 4: Administrador da Clínica (ou superior)
const SUPER_ADMIN_PERMISSION_ID = 5; // ID do nível de permissão para Super Admin

const UserListPage: React.FC<UserListPageProps> = ({ clinicData }) => {
    const navigate = useNavigate();
    const { isLoadingAuth } = useAuth(); // Use useAuth to check overall auth loading
    const [searchTerm, setSearchTerm] = useState('');
    const [sortValue, setSortValue] = useState('created_at_desc');
    const [filterPermissionLevel, setFilterPermissionLevel] = useState<string>('all');
    const [currentPage, setCurrentPage] = useState(1);

    const ITEMS_PER_PAGE = 15;

    const currentClinicId = clinicData?.id;
    const userPermissionLevel = clinicData?.id_permissao;
    // Lógica de permissão corrigida: userPermissionLevel DEVE SER MAIOR OU IGUAL ao REQUIRED_PERMISSION_LEVEL
    const hasPermission = !isLoadingAuth && userPermissionLevel !== undefined && userPermissionLevel >= REQUIRED_PERMISSION_LEVEL;

    // Fetch all permission levels for the filter dropdown
    const { data: permissionLevels, isLoading: isLoadingPermissionLevels, error: permissionLevelsError } = useQuery<PermissionLevel[]>({
        queryKey: ['permissionLevels'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('permission_levels')
                .select('id, name, description')
                .order('id', { ascending: true });
            if (error) throw new Error(error.message);
            return data || [];
        },
        staleTime: Infinity, // Permissions don't change often
        refetchOnWindowFocus: false,
    });

    // Fetch users with their roles for the current clinic
    const { data: usersData, isLoading: isLoadingUsers, error: usersError } = useQuery<{ users: SupabaseUser[], totalCount: number } | null>({
        queryKey: ['clinicUsers', currentClinicId, searchTerm, sortValue, filterPermissionLevel], // Removed currentPage and ITEMS_PER_PAGE from key
        queryFn: async ({ queryKey }) => {
            const [, clinicId, search, sort, permissionFilter] = queryKey;

            if (!clinicId) {
                console.warn("UserListPage: Skipping users fetch due to missing clinicId.");
                return { users: [], totalCount: 0 };
            }

            console.log(`UserListPage: Fetching users for clinic ${clinicId} with filters:`, { search, sort, permissionFilter });

            let query = supabase
                .from('profiles')
                .select(`
                    id,
                    email,
                    first_name,
                    last_name,
                    created_at,
                    user_clinic_roles!user_id(
                        id,
                        clinic_id,
                        permission_level_id,
                        is_active,
                        permission_levels(name, description)
                    )
                `, { count: 'exact' }) // Keep count: 'exact' for initial fetch, but we'll use client-side count
                .filter('user_clinic_roles.clinic_id', 'eq', clinicId); // Filter by roles in this clinic

            // Apply search filter (mantido no Supabase para eficiência)
            if (search) {
                const searchTermLower = search.toLowerCase();
                query = query.or(`first_name.ilike.%${searchTermLower}%,last_name.ilike.%${searchTermLower}%,email.ilike.%${searchTermLower}%`);
            }

            // Apply sorting (mantido no Supabase para eficiência)
            let orderByColumn = 'created_at';
            let ascending = false;
            switch (sort) {
                case 'created_at_desc': orderByColumn = 'created_at'; ascending = false; break;
                case 'created_at_asc': orderByColumn = 'created_at'; ascending = true; break;
                case 'name_asc': orderByColumn = 'first_name'; ascending = true; break;
                case 'name_desc': orderByColumn = 'first_name'; ascending = false; break;
                case 'email_asc': orderByColumn = 'email'; ascending = true; break;
                case 'email_desc': orderByColumn = 'email'; ascending = false; break;
                default: break;
            }
            query = query.order(orderByColumn, { ascending: ascending });

            // NÃO APLICAR PAGINAÇÃO AQUI. Buscamos todos os dados relevantes primeiro.
            const { data, error } = await query;

            console.log('UserListPage: Supabase users raw fetch result:', { data, error });

            if (error) {
                console.error("UserListPage: Supabase users fetch error:", error);
                throw new Error(`Erro ao buscar usuários: ${error.message}`);
            }

            const allUsersFromSupabase = data || [];

            // Filtragem completa no lado do cliente para garantir consistência com a contagem
            const finalFilteredUsers = allUsersFromSupabase.filter(user =>
                user.user_clinic_roles.some(role =>
                    String(role.clinic_id) === String(clinicId) && // Deve ser da clínica atual
                    role.is_active && // Deve ser um papel ativo
                    role.permission_level_id !== SUPER_ADMIN_PERMISSION_ID && // NÃO deve ser Super Admin
                    (permissionFilter === 'all' || role.permission_level_id === parseInt(permissionFilter, 10)) // Aplica o filtro de permissão selecionado
                )
            );

            // A contagem total agora é o tamanho da lista filtrada
            return { users: finalFilteredUsers, totalCount: finalFilteredUsers.length };
        },
        enabled: hasPermission && !!currentClinicId && !isLoadingPermissionLevels, // Only fetch if user has permission and clinicId is available
        staleTime: 60 * 1000, // Cache data for 1 minute
        refetchOnWindowFocus: false,
    });

    // Aplicar paginação aos dados já filtrados
    const paginatedUsersToDisplay = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        return (usersData?.users || []).slice(startIndex, endIndex);
    }, [usersData?.users, currentPage, ITEMS_PER_PAGE]);

    const totalItems = usersData?.totalCount ?? 0;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    // Adjust current page if filtering/sorting reduces total pages
    useEffect(() => {
        if (totalItems > 0) {
            const newTotalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
            if (currentPage > newTotalPages) {
                setCurrentPage(newTotalPages);
            }
        } else if (totalItems === 0 && currentPage !== 1) {
             setCurrentPage(1);
        }
    }, [totalItems, currentPage]);

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const handleAddUser = () => {
        navigate('/dashboard/register-user');
    };

    if (isLoadingAuth || isLoadingPermissionLevels) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-100px)] bg-gray-100 p-4">
                <Loader2 className="mx-auto h-12 w-12 text-primary mb-4 animate-spin" />
                <CardTitle className="text-2xl font-bold text-primary">Carregando...</CardTitle>
            </div>
        );
    }

    if (!hasPermission) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-100px)] bg-gray-100 p-4">
                <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <TriangleAlert className="mx-auto h-12 w-12 text-red-500 mb-4" />
                        <CardTitle className="text-2xl font-bold text-destructive">Acesso Negado</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-gray-700">Você não tem permissão para acessar esta página.</p>
                        <p className="mt-2 text-gray-600 text-sm">Se você acredita que isso é um erro, entre em contato com o administrador.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="user-list-container flex flex-col h-full p-6 bg-gray-100">
            <div className="content-header flex flex-col sm:flex-row items-center justify-between mb-6 gap-4 flex-shrink-0">
                <h1 className="page-title text-2xl font-bold text-primary whitespace-nowrap">
                    Lista de Usuários
                </h1>
                <div className="search-wrapper flex items-center gap-4 flex-grow min-w-[250px]">
                    <div className="relative flex-grow max-w-sm">
                         <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                         <Input
                            type="text"
                            placeholder="Buscar usuário (nome, email)..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="pl-9"
                         />
                    </div>
                    <span id="recordsCount" className="text-sm text-gray-600 whitespace-nowrap">
                        {isLoadingUsers ? 'Carregando...' : `${totalItems} registro(s)`}
                    </span>
                    <Select value={filterPermissionLevel} onValueChange={(value) => { setFilterPermissionLevel(value); setCurrentPage(1); }}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filtrar por Permissão" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas as Permissões</SelectItem>
                            {permissionLevels?.map(level => (
                                <SelectItem key={level.id} value={String(level.id)} disabled={level.id === SUPER_ADMIN_PERMISSION_ID}>
                                    {level.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={sortValue} onValueChange={(value) => { setSortValue(value); setCurrentPage(1); }}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Ordenar por..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="created_at_desc">Cadastro mais recente</SelectItem>
                            <SelectItem value="created_at_asc">Cadastro mais antigo</SelectItem>
                            <SelectItem value="name_asc">Nome (A-Z)</SelectItem>
                            <SelectItem value="name_desc">Nome (Z-A)</SelectItem>
                            <SelectItem value="email_asc">Email (A-Z)</SelectItem>
                            <SelectItem value="email_desc">Email (Z-A)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Button onClick={handleAddUser} className="flex-shrink-0">
                    <UserPlus className="h-4 w-4 mr-2" /> Adicionar Usuário
                </Button>
            </div>

            <Card className="user-list-container h-full flex flex-col">
                <CardContent className="p-0 flex-grow overflow-y-auto">
                    {isLoadingUsers ? (
                        <div className="flex flex-col items-center justify-center h-full text-primary p-8">
                            <Loader2 className="h-12 w-12 animate-spin mb-4" />
                            <span className="text-lg">Carregando usuários...</span>
                        </div>
                    ) : usersError ? (
                        <div className="flex flex-col items-center justify-center h-full text-red-600 p-8 bg-red-50 rounded-md">
                            <TriangleAlert className="h-12 w-12 mb-4" />
                            <span className="text-lg text-center">Erro ao carregar usuários: {usersError.message}</span>
                            <Button variant="outline" onClick={() => { /* refetch logic */ }} className="mt-4">Tentar Novamente</Button>
                        </div>
                    ) : totalItems === 0 && searchTerm !== '' ? (
                         <div className="flex flex-col items-center justify-center h-full text-gray-600 p-8 bg-gray-50 rounded-md">
                            <Info className="h-16 w-16 mb-4" />
                            <span className="text-lg text-center">Nenhum usuário encontrado com o filtro "{searchTerm}".</span>
                        </div>
                    ) : totalItems === 0 ? (
                         <div className="flex flex-col items-center justify-center h-full text-gray-600 p-8 bg-gray-50 rounded-md">
                            <Info className="h-16 w-16 mb-4" />
                            <span className="text-lg text-center">Nenhum usuário encontrado para esta clínica.</span>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Permissão</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Cadastro</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedUsersToDisplay.map(user => { // Usar paginatedUsersToDisplay
                                    // Find the role for the current clinic
                                    const clinicRole = user.user_clinic_roles.find(role => String(role.clinic_id) === String(currentClinicId));
                                    const permissionName = clinicRole?.permission_levels?.name || 'N/D';
                                    const isActive = clinicRole?.is_active ?? false;

                                    return (
                                        <TableRow key={user.id}>
                                            <TableCell className="font-medium whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <User className="h-5 w-5 text-primary" />
                                                    {user.first_name} {user.last_name}
                                                </div>
                                            </TableCell>
                                            <TableCell>{user.email}</TableCell>
                                            <TableCell>{permissionName}</TableCell>
                                            <TableCell>
                                                <span className={cn(
                                                    "inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
                                                    isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                )}>
                                                    {isActive ? 'Ativo' : 'Inativo'}
                                                </span>
                                            </TableCell>
                                            <TableCell>{format(new Date(user.created_at), 'dd/MM/yyyy')}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="outline" size="sm" onClick={() => alert(`Editar usuário ${user.email}`)}>
                                                    Editar
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
                {totalItems > 0 && (
                    <div className="pagination-container p-4 border-t border-gray-200 flex justify-between items-center flex-shrink-0">
                        <div className="pagination-info text-sm text-gray-600">
                            Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
                            {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} de {totalItems} registro(s)
                        </div>
                        <Pagination>
                            <PaginationContent>
                                <PaginationItem>
                                    <PaginationPrevious
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        disabled={currentPage <= 1}
                                    />
                                </PaginationItem>
                                <PaginationItem>
                                    <PaginationLink isActive>{currentPage}</PaginationLink>
                                </PaginationItem>
                                <PaginationItem>
                                    <PaginationNext
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        disabled={currentPage >= totalPages}
                                    />
                                </PaginationItem>
                            </PaginationContent>
                        </Pagination>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default UserListPage;