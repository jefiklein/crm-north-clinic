import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom'; // Using Link for navigation
import {
  Users, CalendarCheck, LineChart, MessageSquare, Circle, Loader2, TriangleAlert, Settings, FileText, DollarSign, Briefcase, ClipboardList, Bell, BarChart2, CreditCard, Package, ShoppingCart, TagIcon, Truck, MapPin, Phone, Mail, Globe, Home, Info, HelpCircle, Book, Folder, Database, Server, Cloud, Code, Terminal, Layers, Grid, List, Table2, Calendar, Clock, Map, Compass, Target, AwardIcon as AwardIconLucide, Gift, HeartIcon, StarIcon, SunIcon, MoonIcon, CloudRain, Zap, CoffeeIcon, Feather, Anchor, AtSign, BatteryCharging, BellRing, Bookmark, Box, Camera, Car, Cast, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Chrome, CircleDollarSign, CircleHelp, CircleMinus, CirclePlus, Clock4, CloudDrizzle, CloudFog, CloudHail, CloudLightning, CloudSnow, CloudSun, Code2, Codesandbox, Command, Download, Dribbble, Droplet, Edit, ExternalLink, Eye, Facebook, Figma, File, FileArchive, FileAudio, FileCode, FileHeart, FileImage, FileJson, FileKey, FileMinus, FileMusic, FileOutput, FilePlus, FileQuestion, FileSearch, FileSpreadsheet, FileStack, FileSymlink, FileTerminal, FileType, FileUp, FileVideo, FileWarning, FileX, Filter, Flag, FolderArchive, FolderDot, FolderGit2, FolderGit, FolderOpen, FolderRoot, FolderSearch, FolderSymlink, FolderTree, Frown, Gamepad2, Gauge, Gem, Github, Gitlab, GlobeIcon, GraduationCap, Handshake, HardDrive, Hash, Headphones, Image, Inbox, InfoIcon, Instagram, Key, Keyboard, Lamp, Laptop, LifeBuoy, Lightbulb, Link2, Linkedin, ListIcon, Loader, Lock, LogIn, LogOut, MailIcon, MapIcon, Maximize, Megaphone, Menu, MessageCircle, MessageSquareIcon, Mic, Minimize, Minus, Monitor, MoreHorizontal, MoreVertical, Mountain, Mouse, Music, Navigation, Newspaper, Octagon, Package2, PackageIcon, Paperclip, Pause, PenTool, Percent, PhoneCall, PhoneForwarded, PhoneIncoming, PhoneMissed, PhoneOff, PhoneOutgoing, PhoneOutgoingIcon, PictureInPicture, PieChart, Pin, Play, Plus, Pocket, Power, Printer, Puzzle, QrCode, Radio, Receipt, RectangleHorizontal, RectangleVertical, Redo, RefreshCcw, Repeat, Reply, Rocket, Rss, Save, Scale, Scan, Scissors, Search, Send, ServerIcon, SettingsIcon, Share, Shield, ShoppingBag, ShoppingCartIcon, Shuffle, SidebarClose, SidebarOpen, Sigma, Siren, SkipBack, SkipForward, Slack, Slash, SlidersHorizontal, SlidersVertical, Smile, Snowflake, SortAsc, SortDesc, Speaker, Square, Sticker, StopCircle, Store, Sunrise, Sunset, TableIcon, Thermometer, ThumbsDown, ThumbsUp, Ticket, Timer, ToggleLeft, ToggleRight, Tornado, Train, Trash, Trello, TrendingDown, TrendingUp, Triangle, TriangleAlertIcon, TruckIcon, Tv, Twitch, Twitter, Type, Umbrella, Underline, Undo, Unlock, Upload, UploadCloud, User, UserCheck, UserMinus, UserPlus, UserX, UsersIcon, Utensils, Verified, Video, VideoOff, View, Voicemail, Volume, Volume1, Volume2, VolumeX, Wallet, Wand2, Watch, Waves, Webcam, Wifi, WifiOff, Wind, X, Youtube, ZapIcon, ZoomIn, ZoomOut, MailOpen, Smartphone, MessagesSquare, BadgeDollarSign,
  Headset, UserCog, Bot // NEW: Import new icons
} from 'lucide-react'; // Using Lucide React for icons
import { supabase } from '@/integrations/supabase/client'; // Import Supabase client
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth
import { useQuery } from '@tanstack/react-query'; // Import useQuery
import { Avatar, AvatarFallback } from '@/components/ui/avatar'; // Import Avatar components
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"; // Import Collapsible

// Define the structure for clinic data (should match the one in App.tsx)
interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

interface MenuItem {
  id: string | number; // Allow id to be string or number
  nome: string; // Corresponds to 'label' in previous structure
  webhook_url?: string; // URL to navigate to (can be external or internal) - Keeping for data structure but not used for navigation logic here
  icon_class?: string; // Old Font Awesome class (kept for reference if needed elsewhere)
  icon_key?: string; // New column for Lucide icon key
  permissao_necessaria: number; // Required permission level
  ordem?: number; // Order for sorting
  ativo: boolean; // Assuming there's an 'ativo' column
  parent_id: number | null; // NEW: Parent ID for grouping
  is_group: boolean; // NEW: Indicates if this item is a group header
}

// Define the structure for user profile data
interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

// Mapping from simple keys (stored in icon_key) to Lucide React component
const iconMap: { [key: string]: React.ElementType } = {
  'users': Users,
  'calendar-check': CalendarCheck,
  'chart-line': LineChart,
  'comments': MessageSquare,
  'settings': Settings,
  'file-text': FileText,
  'dollar-sign': DollarSign, // Added DollarSign icon mapping
  'briefcase': Briefcase,
  'clipboard-list': ClipboardList,
  'bell': Bell,
  'chart-bar': BarChart2,
  'credit-card': CreditCard,
  'package': Package,
  'shopping-cart': ShoppingCart,
  'tag': TagIcon,
  'truck': Truck,
  'map-pin': MapPin,
  'phone': Phone,
  'mail': Mail,
  'globe': Globe,
  'home': Home, // Existing mapping
  'info': Info,
  'help-circle': HelpCircle,
  'book': Book,
  'folder': Folder,
  'database': Database,
  'server': Server,
  'cloud': Cloud,
  'code': Code,
  'terminal': Terminal,
  'layers': Layers,
  'grid': Grid,
  'list': List, // Added List icon mapping
  'table': Table2,
  'calendar': Calendar,
  'clock': Clock,
  'map': Map,
  'compass': Compass,
  'target': Target,
  'award': AwardIconLucide,
  'gift': Gift,
  'heart': HeartIcon,
  'star': StarIcon,
  'sun': SunIcon,
  'moon': MoonIcon,
  'cloud-rain': CloudRain,
  'zap': Zap,
  'coffee': CoffeeIcon,
  'feather': Feather,
  'anchor': Anchor,
  'at': AtSign,
  'battery-charging': BatteryCharging,
  'bell-ring': BellRing,
  'bookmark': Bookmark,
  'box': Box,
  'camera': Camera,
  'car': Car,
  'cast': Cast,
  'check-circle': CheckCircle2,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-up': ChevronUp,
  'chrome': Chrome,
  'circle-dollar-sign': CircleDollarSign,
  'circle-help': CircleHelp,
  'circle-minus': CircleMinus,
  'circle-plus': CirclePlus,
  'clock-4': Clock4,
  'cloud-drizzle': CloudDrizzle,
  'cloud-fog': CloudFog,
  'cloud-hail': CloudHail,
  'cloud-lightning': CloudLightning,
  'cloud-snow': CloudSnow,
  'cloud-sun': CloudSun,
  'code-2': Code2,
  'codesandbox': Codesandbox,
  'command': Command,
  'download': Download,
  'dribbble': Dribbble,
  'droplet': Droplet,
  'edit': Edit,
  'external-link': ExternalLink,
  'eye': Eye,
  'facebook': Facebook,
  'figma': Figma,
  'file': File,
  'file-archive': FileArchive,
  'file-audio': FileAudio,
  'file-code': FileCode,
  'file-heart': FileHeart,
  'file-image': FileImage,
  'file-json': FileJson,
  'file-key': FileKey,
  'file-minus': FileMinus,
  'file-music': FileMusic,
  'file-output': FileOutput,
  'file-plus': FilePlus,
  'file-question': FileQuestion,
  'file-search': FileSearch,
  'file-spreadsheet': FileSpreadsheet,
  'file-stack': FileStack,
  'file-symlink': FileSymlink,
  'file-terminal': FileTerminal,
  'file-type': FileType,
  'file-up': FileUp,
  'file-video': FileVideo,
  'file-warning': FileWarning,
  'file-x': FileX,
  'filter': Filter,
  'flag': Flag,
  'folder-archive': FolderArchive,
  'folder-dot': FolderDot,
  'folder-git-2': FolderGit2,
  'folder-git': FolderGit,
  'folder-open': FolderOpen,
  'folder-root': FolderRoot,
  'folder-search': FolderSearch,
  'folder-symlink': FolderSymlink,
  'folder-tree': FolderTree,
  'frown': Frown,
  'gamepad-2': Gamepad2,
  'gauge': Gauge,
  'gem': Gem,
  'github': Github,
  'gitlab': Gitlab,
  'globe-icon': GlobeIcon,
  'graduation-cap': GraduationCap,
  'handshake': Handshake,
  'hard-drive': HardDrive,
  'hash': Hash,
  'headphones': Headphones,
  'image': Image,
  'inbox': Inbox,
  'info-icon': InfoIcon,
  'instagram': Instagram,
  'key': Key, // Added Key icon mapping
  'keyboard': Keyboard,
  'lamp': Lamp,
  'laptop': Laptop,
  'life-buoy': LifeBuoy,
  'lightbulb': Lightbulb,
  'link-2': Link2,
  'linkedin': Linkedin,
  'list-icon': ListIcon,
  'loader': Loader,
  'lock': Lock,
  'log-in': LogIn,
  'log-out': LogOut,
  'mail-icon': MailIcon,
  'map-icon': MapIcon,
  'maximize': Maximize,
  'megaphone': Megaphone,
  'menu': Menu,
  'message-circle': MessageCircle,
  'message-square-icon': MessageSquareIcon,
  'mic': Mic,
  'minimize': Minimize,
  'minus': Minus,
  'monitor': Monitor,
  'more-horizontal': MoreHorizontal,
  'more-vertical': MoreVertical,
  'mountain': Mountain,
  'mouse': Mouse,
  'music': Music,
  'navigation': Navigation,
  'newspaper': Newspaper,
  'octagon': Octagon,
  'package-2': Package2,
  'package-icon': PackageIcon,
  'paperclip': Paperclip,
  'pause': Pause,
  'pen-tool': PenTool,
  'percent': Percent,
  'phone-call': PhoneCall,
  'phone-forwarded': PhoneForwarded,
  'phone-incoming': PhoneIncoming,
  'phone-missed': PhoneMissed,
  'phone-off': PhoneOff,
  'phone-outgoing': PhoneOutgoing,
  'phone-outgoing-icon': PhoneOutgoingIcon,
  'picture-in-picture': PictureInPicture,
  'pie-chart': PieChart,
  'pin': Pin,
  'play': Play,
  'plus': Plus,
  'pocket': Pocket,
  'power': Power,
  'printer': Printer,
  'puzzle': Puzzle,
  'qr-code': QrCode,
  'radio': Radio,
  'receipt': Receipt,
  'rectangle-horizontal': RectangleHorizontal,
  'rectangle-vertical': RectangleVertical,
  'redo': Redo,
  'refresh-ccw': RefreshCcw,
  'repeat': Repeat,
  'reply': Reply,
  'rocket': Rocket,
  'rss': Rss,
  'save': Save,
  'scale': Scale,
  'scan': Scan,
  'scissors': Scissors,
  'search': Search,
  'send': Send,
  'server-icon': ServerIcon,
  'settings-icon': SettingsIcon,
  'share': Share,
  'shield': Shield,
  'shopping-bag': ShoppingBag,
  'shopping-cart-icon': ShoppingCartIcon,
  'shuffle': Shuffle,
  'sidebar-close': SidebarClose,
  'sidebar-open': SidebarOpen,
  'sigma': Sigma,
  'siren': Siren,
  'skip-back': SkipBack,
  'skip-forward': SkipForward,
  'slack': Slack,
  'slash': Slash,
  'sliders-horizontal': SlidersHorizontal,
  'sliders-vertical': SlidersVertical,
  'smile': Smile,
  'snowflake': Snowflake,
  'sort-asc': SortAsc,
  'sort-desc': SortDesc,
  'speaker': Speaker,
  'square': Square, // Corrected syntax here
  'sticker': Sticker,
  'stop-circle': StopCircle,
  'store': Store,
  'sunrise': Sunrise,
  'sunset': Sunset,
  'table-icon': TableIcon,
  'thermometer': Thermometer,
  'thumbs-down': ThumbsDown,
  'thumbs-up': ThumbsUp,
  'ticket': Ticket,
  'timer': Timer,
  'toggle-left': ToggleLeft,
  'toggle-right': ToggleRight,
  'tornado': Tornado,
  'train': Train,
  'trash': Trash,
  'trello': Trello,
  'trending-down': TrendingDown,
  'trending-up': TrendingUp,
  'triangle': Triangle,
  'triangle-alert-icon': TriangleAlertIcon,
  'truck-icon': TruckIcon,
  'tv': Tv,
  'twitch': Twitch,
  'twitter': Twitter,
  'type': Type,
  'umbrella': Umbrella,
  'underline': Underline,
  'undo': Undo,
  'unlock': Unlock,
  'upload': Upload,
  'upload-cloud': UploadCloud,
  'user': User,
  'user-check': UserCheck,
  'user-minus': UserMinus,
  'user-plus': UserPlus,
  'user-x': UserX,
  'users-icon': UsersIcon,
  'utensils': Utensils,
  'verified': Verified,
  'video': Video,
  'video-off': VideoOff,
  'view': View,
  'voicemail': Voicemail,
  'volume': Volume,
  'volume1': Volume1,
  'volume2': Volume2,
  'volumeX': VolumeX,
  'wallet': Wallet,
  'wand-2': Wand2,
  'watch': Watch,
  'waves': Waves,
  'webcam': Webcam,
  'wifi': Wifi,
  'wifi-off': WifiOff,
  'wind': Wind,
  'x': X,
  'youtube': Youtube,
  'zap-icon': ZapIcon,
  'zoom-in': ZoomIn,
  'zoom-out': ZoomOut,
  'mail-open': MailOpen,
  'smartphone': Smartphone,
  'messages-square': MessagesSquare,
  'badge-dollar-sign': BadgeDollarSign,
  'headset': Headset, // NEW: Headset icon
  'user-cog': UserCog, // NEW: UserCog icon
  'bot': Bot // NEW: Bot icon
}


// Function to get Lucide icon component from the icon key
const getLucideIcon = (iconKey?: string) => {
  if (!iconKey) return Circle; // Default icon if key is missing

  // Look up in the map, return default if key not found
  return iconMap[iconKey] || Circle;
};

// Helper function to get initials for AvatarFallback
function getInitials(name: string | null): string {
  if (!name) return '??';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length > 1) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  } else if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return '??';
}

export const Sidebar: React.FC = () => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation(); // Hook to get current location
  const { session } = useAuth(); // Get session from AuthContext
  const [expandedGroups, setExpandedGroups] = useState<Set<number | string>>(new Set()); // State to manage expanded groups

  // Retrieve clinicData from localStorage directly within the component for now
  // A better approach would be using React Context or a state management library
  const clinicData: ClinicData | null = JSON.parse(localStorage.getItem('selectedClinicData') || 'null'); // Use selectedClinicData

  console.log("Sidebar: clinicData from localStorage:", clinicData);

  // Fetch user profile data
  const { data: userProfile, isLoading: isLoadingProfile, error: profileError } = useQuery<UserProfile | null>({
    queryKey: ['userProfile', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('id', session.user.id)
        .single();
      if (error && error.code !== 'PGRST116') { // PGRST116 means "No rows found"
        throw new Error(error.message);
      }
      return data || null;
    },
    enabled: !!session?.user?.id, // Only fetch if user ID is available
    staleTime: 5 * 60 * 1000, // Cache profile data for 5 minutes
    refetchOnWindowFocus: false,
  });


  useEffect(() => {
    const fetchMenu = async () => {
      console.log("Sidebar: Inside fetchMenu useEffect");
      if (!clinicData || !clinicData.code || typeof clinicData.id_permissao === 'undefined') {
        console.log("Sidebar: clinicData incomplete, skipping fetch.");
        setError("Dados da clínica incompletos para carregar o menu.");
        setIsLoading(false);
        setMenuItems([]); // Clear menu if data is incomplete
        return;
      }

      setIsLoading(true);
      setError(null);
      setMenuItems([]); // Clear previous menu items

      const userPermissionLevel = parseInt(clinicData.id_permissao.toString(), 10);
      console.log("Sidebar: User permission level:", userPermissionLevel);

      if (isNaN(userPermissionLevel)) {
           console.error("Sidebar: Invalid user permission level:", clinicData.id_permissao);
           setError("Nível de permissão do usuário inválido.");
           setIsLoading(false);
           setMenuItems([]);
           return;
      }

      console.log("Sidebar: Fetching menu from Supabase...");

      try {
        const { data, error } = await supabase
          .from('north_clinic_crm_menu')
          .select('id, nome, webhook_url, icon_class, icon_key, permissao_necessaria, ordem, ativo, parent_id, is_group') // Select the new icon_key, parent_id, is_group columns
          .eq('ativo', true) // Assuming 'ativo' column exists and filters active items
          .order('ordem', { ascending: true }); // Order by 'ordem'

        console.log("Sidebar: Supabase fetch result - data:", data, "error:", error);

        if (error) {
          throw new Error(error.message);
        }

        if (!data || !Array.isArray(data)) {
          throw new Error("Formato de menu inválido (esperado Array)");
        }

        console.log("Sidebar: Raw menu data from Supabase:", data);

        // Filter by permission
        const filteredItems = data.filter(item => {
          const requiredPermission = parseInt(item.permissao_necessaria?.toString(), 10);
          // If requiredPermission is NaN or <= 0, it's accessible to everyone (or no specific restriction)
          if (isNaN(requiredPermission) || requiredPermission <= 0) {
            return true;
          }
          // Otherwise, check if user's permission level is sufficient
          return userPermissionLevel >= requiredPermission;
        });

        console.log("Sidebar: Filtered menu items:", filteredItems);
        
        let finalMenuItems = [...filteredItems];
        
        // Re-sort to ensure the new item is in place if order matters
        finalMenuItems.sort((a, b) => (a.ordem || Infinity) - (b.ordem || Infinity));


        setMenuItems(finalMenuItems as MenuItem[]); // Cast to MenuItem[]

      } catch (err: any) {
        console.error("Sidebar: Erro ao buscar menu:", err);
        setError(`Falha ao carregar menu: ${err.message}`);
        setMenuItems([]); // Clear menu on error
      } finally {
        setIsLoading(false);
        console.log("Sidebar: Fetch menu finished.");
      }
    };

    // Fetch menu only if clinicData is available
    if (clinicData && clinicData.code && typeof clinicData.id_permissao !== 'undefined') {
        fetchMenu();
    } else {
        console.log("Sidebar: clinicData not fully available, skipping fetch.");
        // If clinicData is not available, clear menu and show error/loading state accordingly
        setIsLoading(false);
        setError("Faça login para ver o menu.");
        setMenuItems([]);
    }

  }, [clinicData?.code, clinicData?.id_permissao]); // Re-fetch menu if clinicData code or permission changes


  // Determine active menu item based on current route
  const getActive = (item: MenuItem, allItems: MenuItem[]) => {
      // Determine the expected internal path for this item
      let itemPath: string;
      if (item.icon_key === 'user-plus') {
          itemPath = '/dashboard/register-user';
      } else if (String(item.id) === '1') {
          itemPath = '/dashboard';
      } else {
          itemPath = `/dashboard/${item.id}`;
      }

      // Check if the current location pathname matches the item's path
      const isDirectlyActive = location.pathname === itemPath || (itemPath === '/dashboard' && location.pathname === '/dashboard/');

      // If it's a group, check if any of its children are active
      if (item.is_group) {
          const children = allItems.filter(child => child.parent_id === item.id);
          const isChildActive = children.some(child => getActive(child, allItems)); // Recursively check children
          return isDirectlyActive || isChildActive;
      }

      return isDirectlyActive;
  };

  // Toggle group expansion
  const toggleGroup = (groupId: number | string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  // Filter top-level items (groups and non-grouped items)
  const topLevelItems = menuItems.filter(item => item.parent_id === null);

  // Function to render a single menu item (or group header)
  const renderMenuItem = (item: MenuItem, isChild: boolean = false) => {
    const IconComponent = getLucideIcon(item.icon_key || (item.icon_class ? item.icon_class.match(/fa-([^ ]+)/)?.[1] : undefined));
    const isActive = getActive(item, menuItems);

    let finalTo: string;
    if (item.icon_key === 'user-plus') {
        finalTo = '/dashboard/register-user';
    } else if (String(item.id) === '1') {
        finalTo = '/dashboard';
    } else {
        finalTo = `/dashboard/${item.id}`;
    }

    const baseClasses = `flex items-center py-3 text-gray-400 hover:text-gray-50 hover:bg-gray-800 transition-colors duration-200`;
    const activeClasses = `text-blue-400 bg-gray-700 border-l-4 border-blue-400 pl-[calc(1rem-4px)]`;
    const paddingClasses = isChild ? 'pl-8' : 'pl-4'; // Indent children

    if (item.is_group) {
      const isGroupExpanded = expandedGroups.has(item.id);
      return (
        <Collapsible
          key={item.id}
          open={isGroupExpanded}
          onOpenChange={() => toggleGroup(item.id)}
        >
          <CollapsibleTrigger asChild>
            <div className={`${baseClasses} ${paddingClasses} ${isActive ? activeClasses : ''} cursor-pointer pr-4`}>
              {React.createElement(IconComponent, { className: "h-5 w-5 mr-3 flex-shrink-0" })}
              <span className="menu-text text-sm transition-opacity duration-300 group-hover:opacity-100 opacity-0 flex-grow text-left">{item.nome}</span>
              {isGroupExpanded ? (
                <ChevronUp className="h-4 w-4 ml-auto transition-transform duration-200 group-hover:opacity-100 opacity-0" />
              ) : (
                <ChevronDown className="h-4 w-4 ml-auto transition-transform duration-200 group-hover:opacity-100 opacity-0" />
              )}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {menuItems
              .filter(child => child.parent_id === item.id)
              .sort((a, b) => (a.ordem || Infinity) - (b.ordem || Infinity))
              .map(child => renderMenuItem(child, true))}
          </CollapsibleContent>
        </Collapsible>
      );
    } else {
      // Regular menu item (not a group)
      return (
        <Link
          key={item.id}
          to={finalTo}
          className={`${baseClasses} ${paddingClasses} ${isActive ? activeClasses : ''}`}
        >
          {React.createElement(IconComponent, { className: "h-5 w-5 mr-3 flex-shrink-0" })}
          <span className="menu-text text-sm transition-opacity duration-300 group-hover:opacity-100 opacity-0">{item.nome}</span>
        </Link>
      );
    }
  };


  return (
    // Sidebar container: fixed width, dark background, flex column
    // Added group class for hover effect
    // Updated background and text colors
    <div className="group flex flex-col w-16 hover:w-64 bg-gray-900 text-gray-100 transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center justify-center h-16 mt-4 mb-8 flex-shrink-0">
         {/* Replace with your logo component or img tag */}
         <img src="/north-crm.jpeg" alt="North Clinic Logo" className="h-12 w-12 object-contain group-hover:w-20 group-hover:h-20 transition-all duration-300" />
      </div>

      {/* Main Menu Items */}
      <nav className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center px-4 py-3 text-gray-400"> {/* Adjusted text color */}
            <Loader2 className="h-5 w-5 mr-3 animate-spin" />
            <span className="menu-text text-sm transition-opacity duration-300 group-hover:opacity-100 opacity-0">Carregando...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center px-4 py-3 text-red-500"> {/* Adjusted text color */}
            <TriangleAlert className="h-5 w-5 mr-3" />
            <span className="menu-text text-sm transition-opacity duration-300 group-hover:opacity-100 opacity-0">{error}</span>
          </div>
        )}

        {!isLoading && !error && menuItems.length === 0 && (
             <div className="flex items-center px-4 py-3 text-gray-400"> {/* Adjusted text color */}
                <Circle className="h-5 w-5 mr-3" /> {/* Using a generic icon */}
                <span className="menu-text text-sm transition-opacity duration-300 group-hover:opacity-100 opacity-0">Sem itens de menu</span>
             </div>
        )}

        {topLevelItems.map(item => renderMenuItem(item))}
      </nav>

      {/* Fixed bottom section for user profile and change password */}
      {session?.user && (
        <div className="user-bottom-section flex-shrink-0 p-4 border-t border-gray-700 flex items-center justify-center group-hover:justify-start">
          {isLoadingProfile ? (
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          ) : profileError ? (
            <TriangleAlert className="h-6 w-6 text-red-400" />
          ) : userProfile ? (
            <Link
              to="/dashboard/change-password"
              className={`flex items-center w-full text-gray-400 hover:text-blue-400 transition-colors duration-200 ${location.pathname === '/dashboard/change-password' ? 'text-blue-400' : ''}`}
            >
              <div className="flex-shrink-0">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-gray-700 text-gray-100 text-sm font-semibold">
                    {getInitials(userProfile.first_name || userProfile.email)}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="flex-grow ml-3 overflow-hidden whitespace-nowrap transition-opacity duration-300 group-hover:opacity-100 opacity-0">
                <span className="font-semibold text-sm block truncate">
                  {userProfile.first_name || userProfile.email?.split('@')[0]}
                </span>
                <span className="text-xs block truncate">Alterar Senha</span>
              </div>
            </Link>
          ) : (
            <div className="flex items-center text-gray-400">
              <User className="h-6 w-6" />
              <span className="ml-3 text-sm transition-opacity duration-300 group-hover:opacity-100 opacity-0">Perfil</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};