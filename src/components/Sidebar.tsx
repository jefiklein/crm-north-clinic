import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom'; // Using Link for navigation
import {
  Users, CalendarCheck, LineChart, MessageSquare, Circle, Loader2, TriangleAlert, Settings, FileText, DollarSign, Briefcase, ClipboardList, Bell, BarChart2, CreditCard, Package, ShoppingCart, Tag, Truck, MapPin, Phone, Mail, Globe, Home, Info, HelpCircle, Book, Folder, Database, Server, Cloud, Code, Terminal, Layers, Grid, List, Table2, Calendar, Clock, Map, Compass, Target, AwardIcon, Gift, HeartIcon, StarIcon, SunIcon, MoonIcon, CloudRain, Zap, CoffeeIcon, Feather, Anchor, AtSign, AwardIcon as AwardIconLucide, BatteryCharging, BellRing, Bookmark, Box, Camera, Car, Cast, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Chrome, CircleDollarSign, CircleHelp, CircleMinus, CirclePlus, Clock4, CloudDrizzle, CloudFog, CloudHail, CloudLightning, CloudSnow, CloudSun, Code2, Codesandbox, Command, Download, Dribbble, Droplet, Edit, ExternalLink, Eye, Facebook, Figma, File, FileArchive, FileAudio, FileCode, FileHeart, FileImage, FileJson, FileKey, FileMinus, FileMusic, FileOutput, FilePlus, FileQuestion, FileSearch, FileSpreadsheet, FileStack, FileSymlink, FileTerminal, FileTextIcon, FileType, FileUp, FileVideo, FileWarning, FileX, Filter, Flag, FolderArchive, FolderDot, FolderGit2, FolderGit, FolderOpen, FolderRoot, FolderSearch, FolderSymlink, FolderTree, Frown, Gamepad2, Gauge, Gem, Github, Gitlab, GlobeIcon, GraduationCap, Handshake, HardDrive, Hash, Headphones, Image, Inbox, InfoIcon, Instagram, Key, Keyboard, Lamp, Laptop, LayoutDashboard, LifeBuoy, Lightbulb, Link2, Linkedin, ListIcon, Loader, Lock, LogIn, LogOut, MailIcon, MapIcon, Maximize, Megaphone, Menu, MessageCircle, MessageSquareIcon, Mic, Minimize, Minus, Monitor, MoreHorizontal, MoreVertical, Mountain, Mouse, Music, Navigation, Newspaper, Octagon, Package2, PackageIcon, Paperclip, Pause, PenTool, Percent, PhoneCall, PhoneForwarded, PhoneIncoming, PhoneMissed, PhoneOff, PhoneOutgoing, PhoneOutgoingIcon, PhonePause, PhoneX, PictureInPicture, PieChart, Pin, Play, Plus, Pocket, Power, Printer, Puzzle, QrCode, Radio, Receipt, RectangleHorizontal, RectangleVertical, Redo, RefreshCcw, Repeat, Reply, Rocket, Rss, Save, Scale, Scan, Scissors, Search, Send, ServerIcon, SettingsIcon, Share, Shield, ShoppingBag, ShoppingCartIcon, Shuffle, SidebarClose, SidebarOpen, Sigma, Signal, Siren, SkipBack, SkipForward, Slack, Slash, SlidersHorizontal, SlidersVertical, Smile, Snowflake, SortAsc, SortDesc, Speaker, Square, Sticker, StopCircle, Store, Sunrise, Sunset, TableIcon, TagIcon, TargetIcon, Tent, TerminalIcon, Thermometer, ThumbsDown, ThumbsUp, Ticket, Timer, ToggleLeft, ToggleRight, Tornado, Train, Trash, Trello, TrendingDown, TrendingUp, Triangle, TriangleAlertIcon, TruckIcon, Tv, Twitch, Twitter, Type, Umbrella, Underline, Undo, Unlock, Upload, UploadCloud, User, UserCheck, UserMinus, UserPlus, UserX, UsersIcon, Utensils, Verified, Video, VideoOff, View, Voicemail, Volume, Volume1, Volume2, VolumeX, Wallet, Wand2, Watch, Waves, Webcam, Wifi, WifiOff, Wind, X, Youtube, ZapIcon, ZoomIn, ZoomOut
} from 'lucide-react'; // Using Lucide React for icons

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
  id: string;
  label: string;
  webhook_url?: string; // URL to navigate to (can be external or internal)
  icon_class?: string; // Font Awesome class from backend
  permissao_necessaria: number; // Required permission level
  ordem?: number; // Order for sorting
}

interface SidebarProps {
  clinicData: ClinicData | null;
}

const N8N_BASE_URL = 'https://n8n-n8n.sbw0pc.easypanel.host'; // Keep the base URL

// Simple mapping from Font Awesome class parts to Lucide React component names
// This is a basic mapping and might need expansion based on actual backend data
const iconMap: { [key: string]: React.ElementType } = {
  'users': Users,
  'calendar-check': CalendarCheck,
  'chart-line': LineChart,
  'comments': MessageSquare,
  'sign-out-alt': LogOut, // Although logout is in Header, keeping here for completeness
  'spinner': Loader2,
  'exclamation-triangle': TriangleAlert,
  'cog': Settings, // Example mapping for settings
  'file-alt': FileText, // Example mapping for file
  'dollar-sign': DollarSign, // Example mapping for finance
  'briefcase': Briefcase, // Example mapping for business
  'clipboard-list': ClipboardList, // Example mapping for lists
  'bell': Bell, // Example mapping for notifications
  'chart-bar': BarChart2, // Example mapping for charts
  'credit-card': CreditCard, // Example mapping for payments
  'box': Package, // Example mapping for package
  'shopping-cart': ShoppingCart, // Example mapping for cart
  'tag': TagIcon, // Corrected mapping to TagIcon
  'truck': Truck, // Example mapping for shipping
  'map-marker-alt': MapPin, // Example mapping for location
  'phone': Phone, // Example mapping for phone
  'envelope': Mail, // Example mapping for mail
  'globe': Globe, // Example mapping for globe
  'home': Home, // Example mapping for home
  'info-circle': Info, // Example mapping for info
  'question-circle': HelpCircle, // Example mapping for help
  'book': Book, // Example mapping for book
  'folder': Folder, // Example mapping for folder
  'database': Database, // Example mapping for database
  'server': Server, // Example mapping for server
  'cloud': Cloud, // Example mapping for cloud
  'code': Code, // Example mapping for code
  'terminal': Terminal, // Example mapping for terminal
  'layers': Layers, // Example mapping for layers
  'grip-horizontal': Grid, // Example mapping for grid
  'list': List, // Example mapping for list
  'table': Table2, // Example mapping for table
  'calendar': Calendar, // Example mapping for calendar
  'clock': Clock, // Example mapping for clock
  'map': Map, // Example mapping for map
  'compass': Compass, // Example mapping for compass
  'crosshairs': Target, // Example mapping for target
  'award': AwardIconLucide, // Using the aliased name
  'gift': Gift, // Example mapping for gift
  'heart': HeartIcon, // Example mapping for heart
  'star': StarIcon, // Example mapping for star
  'sun': SunIcon, // Example mapping for sun
  'moon': MoonIcon, // Example mapping for moon
  'cloud-rain': CloudRain, // Example mapping for rain
  'bolt': Zap, // Example mapping for zap
  'coffee': CoffeeIcon, // Example mapping for coffee
  'feather': Feather, // Example mapping for feather
  'anchor': Anchor, // Example mapping for anchor
  'at': AtSign, // Example mapping for at
  'battery-charging': BatteryCharging, // Example mapping for battery
  'bell-slash': BellRing, // Example mapping for bell slash
  'bookmark': Bookmark, // Example mapping for bookmark
  'box': Box, // Example mapping for box
  'camera': Camera, // Example mapping for camera
  'car': Car, // Example mapping for car
  'cast': Cast, // Example mapping for cast
  'check-circle': CheckCircle2, // Example mapping for check circle
  'chevron-down': ChevronDown, // Example mapping for chevron down
  'chevron-left': ChevronLeft, // Example mapping for chevron left
  'chevron-right': ChevronRight, // Example mapping for chevron right
  'chevron-up': ChevronUp, // Example mapping for chevron up
  'chrome': Chrome, // Example mapping for chrome
  'circle-dollar-sign': CircleDollarSign, // Example mapping for circle dollar sign
  'circle-help': CircleHelp, // Example mapping for circle help
  'circle-minus': CircleMinus, // Example mapping for circle minus
  'circle-plus': CirclePlus, // Example mapping for circle plus
  'clock': Clock4, // Example mapping for clock
  'cloud-drizzle': CloudDrizzle, // Example mapping for drizzle
  'cloud-fog': CloudFog, // Example mapping for fog
  'cloud-hail': CloudHail, // Example mapping for hail
  'cloud-lightning': CloudLightning, // Example mapping for lightning
  'cloud-snow': CloudSnow, // Example mapping for snow
  'cloud-sun': CloudSun, // Example mapping for sun cloud
  'code-branch': Code2, // Example mapping for code branch
  'codesandbox': Codesandbox, // Example mapping for codesandbox
  'command': Command, // Example mapping for command
  'download': Download, // Example mapping for download
  'dribbble': Dribbble, // Example mapping for dribbble
  'droplet': Droplet, // Example mapping for droplet
  'edit': Edit, // Example mapping for edit
  'external-link-alt': ExternalLink, // Example mapping for external link
  'eye': Eye, // Example mapping for eye
  'facebook': Facebook, // Example mapping for facebook
  'figma': Figma, // Example mapping for figma
  'file': File, // Example mapping for file
  'file-archive': FileArchive, // Example mapping for file archive
  'file-audio': FileAudio, // Example mapping for file audio
  'file-code': FileCode, // Example mapping for file code
  'file-heart': FileHeart, // Example mapping for file heart
  'file-image': FileImage, // Example mapping for file image
  'file-json': FileJson, // Example mapping for file json
  'file-key': FileKey, // Example mapping for file key
  'file-minus': FileMinus, // Example mapping for file minus
  'file-music': FileMusic, // Example mapping for file music
  'file-output': FileOutput, // Example mapping for file output
  'file-plus': FilePlus, // Example mapping for file plus
  'file-question': FileQuestion, // Example mapping for file question
  'file-search': FileSearch, // Example mapping for file search
  'file-spreadsheet': FileSpreadsheet, // Corrected import
  'file-stack': FileStack, // Example mapping for file stack
  'file-symlink': FileSymlink, // Example mapping for file symlink
  'file-terminal': FileTerminal, // Example mapping for file terminal
  'file-type': FileType, // Example mapping for file type
  'file-upload': FileUp, // Example mapping for file upload
  'file-video': FileVideo, // Example mapping for file video
  'file-warning': FileWarning, // Example mapping for file warning
  'file-times': FileX, // Example mapping for file times
  'filter': Filter, // Example mapping for filter
  'flag': Flag, // Example mapping for flag
  'folder-archive': FolderArchive, // Example mapping for folder archive
  'folder-dot': FolderDot, // Example mapping for folder dot
  'folder-git': FolderGit, // Example mapping for folder git
  'folder-open': FolderOpen, // Example mapping for folder open
  'folder-plus': FolderRoot, // Example mapping for folder plus
  'folder-search': FolderSearch, // Example mapping for folder search
  'folder-symlink': FolderSymlink, // Example mapping for folder symlink
  'folder-tree': FolderTree, // Example mapping for folder tree
  'frown': Frown, // Example mapping for frown
  'gamepad': Gamepad2, // Example mapping for gamepad
  'gauge': Gauge, // Example mapping for gauge
  'gem': Gem, // Example mapping for gem
  'github': Github, // Example mapping for github
  'gitlab': Gitlab, // Example mapping for gitlab
  'graduation-cap': GraduationCap, // Example mapping for graduation cap
  'handshake': Handshake, // Example mapping for handshake
  'hdd': HardDrive, // Example mapping for hdd
  'hashtag': Hash, // Example mapping for hashtag
  'headphones': Headphones, // Example mapping for headphones
  'image': Image, // Example mapping for image
  'inbox': Inbox, // Example mapping for inbox
  'instagram': Instagram, // Example mapping for instagram
  'key': Key, // Example mapping for key
  'keyboard': Keyboard, // Example mapping for keyboard
  'lamp': Lamp, // Example mapping for lamp
  'laptop': Laptop, // Example mapping for laptop
  'life-ring': LifeBuoy, // Example mapping for life ring
  'lightbulb': Lightbulb, // Example mapping for lightbulb
  'link': Link2, // Example mapping for link
  'linkedin': Linkedin, // Example mapping for linkedin
  'loader': Loader, // Example mapping for loader
  'lock': Lock, // Example mapping for lock
  'log-in': LogIn, // Example mapping for log in
  'maximize': Maximize, // Example mapping for maximize
  'microphone': Mic, // Example mapping for microphone
  'minimize': Minimize, // Example mapping for minimize
  'minus': Minus, // Example mapping for minus
  'monitor': Monitor, // Example mapping for monitor
  'more-horizontal': MoreHorizontal, // Example mapping for more horizontal
  'more-vertical': MoreVertical, // Example mapping for more vertical
  'mountain': Mountain, // Example mapping for mountain
  'mouse': Mouse, // Example mapping for mouse
  'music': Music, // Example mapping for music
  'navigation': Navigation, // Example mapping for navigation
  'newspaper': Newspaper, // Example mapping for newspaper
  'octagon': Octagon, // Example mapping for octagon
  'paperclip': Paperclip, // Example mapping for paperclip
  'pause': Pause, // Example mapping for pause
  'pen-tool': PenTool, // Example mapping for pen tool
  'percent': Percent, // Example mapping for percent
  'picture-in-picture': PictureInPicture, // Example mapping for picture in picture
  'pie-chart': PieChart, // Example mapping for pie chart
  'pin': Pin, // Example mapping for pin
  'play': Play, // Example mapping for play
  'plus': Plus, // Example mapping for plus
  'pocket': Pocket, // Example mapping for pocket
  'power-off': Power, // Example mapping for power off
  'print': Printer, // Example mapping for print
  'puzzle-piece': Puzzle, // Example mapping for puzzle piece
  'qrcode': QrCode, // Example mapping for qrcode
  'radio': Radio, // Example mapping for radio
  'receipt': Receipt, // Example mapping for receipt
  'redo': Redo, // Example mapping for redo
  'sync-alt': RefreshCcw, // Example mapping for sync alt
  'repeat': Repeat, // Example mapping for repeat
  'reply': Reply, // Example mapping for reply
  'rocket': Rocket, // Example mapping for rocket
  'rss': Rss, // Example mapping for rss
  'save': Save, // Example mapping for save
  'balance-scale': Scale, // Example mapping for balance scale
  'scan': Scan, // Example mapping for scan
  'cut': Scissors, // Example mapping for cut
  'search': Search, // Example mapping for search
  'paper-plane': Send, // Example mapping for paper plane
  'share-alt': Share, // Example mapping for share alt
  'shield-alt': Shield, // Example mapping for shield alt
  'shopping-bag': ShoppingBag, // Example mapping for shopping bag
  'shuffle': Shuffle, // Example mapping for shuffle
  'sidebar': SidebarClose, // Example mapping for sidebar
  'sigma': Sigma, // Example mapping for sigma
  'siren': Siren, // Example mapping for siren
  'skip-back': SkipBack, // Example mapping for skip back
  'skip-forward': SkipForward, // Example mapping for skip forward
  'slack': Slack, // Example mapping for slack
  'slash': Slash, // Example mapping for slash
  'sliders-h': SlidersHorizontal, // Example mapping for sliders h
  'sliders-v': SlidersVertical, // Example mapping for sliders v
  'smile': Smile, // Example mapping for smile
  'snowflake': Snowflake, // Example mapping for snowflake
  'sort-alpha-down': SortAsc, // Example mapping for sort alpha down
  'sort-alpha-up': SortDesc, // Example mapping for sort alpha up
  'volume-up': Speaker, // Example mapping for volume up
  'square': Square, // Example mapping for square
  'sticker': Sticker, // Example mapping for sticker
  'stop-circle': StopCircle, // Example mapping for stop circle
  'store': Store, // Example mapping for store
  'table': Table2, // Example mapping for table
  'thermometer': Thermometer, // Example mapping for thermometer
  'thumbs-down': ThumbsDown, // Example mapping for thumbs down
  'thumbs-up': ThumbsUp, // Example mapping for thumbs up
  'ticket-alt': Ticket, // Example mapping for ticket alt
  'clock': Timer, // Example mapping for clock
  'toggle-off': ToggleLeft, // Example mapping for toggle off
  'toggle-on': ToggleRight, // Example mapping for toggle on
  'tornado': Tornado, // Example mapping for tornado
  'train': Train, // Example mapping for train
  'trash-alt': Trash, // Example mapping for trash alt
  'trello': Trello, // Example mapping for trello
  'trending-down': TrendingDown, // Example mapping for trending down
  'trending-up': TrendingUp, // Example mapping for trending up
  'triangle': Triangle, // Example mapping for triangle
  'truck': TruckIcon, // Example mapping for truck
  'tv': Tv, // Example mapping for tv
  'twitch': Twitch, // Example mapping for twitch
  'twitter': Twitter, // Example mapping for twitter
  'font': Type, // Example mapping for font
  'underline': Underline, // Example mapping for underline
  'undo': Undo, // Example mapping for undo
  'unlock': Unlock, // Example mapping for unlock
  'upload': Upload, // Example mapping for upload
  'upload-cloud': UploadCloud, // Example mapping for upload cloud
  'user': User, // Example mapping for user
  'user-check': UserCheck, // Example mapping for user check
  'user-minus': UserMinus, // Example mapping for user minus
  'user-plus': UserPlus, // Example mapping for user plus
  'user-times': UserX, // Example mapping for user times
  'utensils': Utensils, // Example mapping for utensils
  'check-double': Verified, // Example mapping for check double
  'video': Video, // Example mapping for video
  'video-slash': VideoOff, // Example mapping for video slash
  'eye-slash': View, // Example mapping for eye slash
  'voicemail': Voicemail, // Example mapping for voicemail
  'volume': Volume, // Example mapping for volume
  'volume-down': Volume1, // Example mapping for volume down
  'volume-up': Volume2, // Example mapping for volume up
  'volume-mute': VolumeX, // Example mapping for volume mute
  'wallet': Wallet, // Example mapping for wallet
  'wand-magic': Wand2, // Example mapping for wand magic
  'watch': Watch, // Example mapping for watch
  'waves': Waves, // Example mapping for waves
  'webcam': Webcam, // Example mapping for webcam
  'wifi': Wifi, // Example mapping for wifi
  'wifi-slash': WifiOff, // Example mapping for wifi slash
  'wind': Wind, // Example mapping for wind
  'times': X, // Example mapping for times
  'youtube': Youtube, // Example mapping for youtube
  'zoom-in': ZoomIn, // Example mapping for zoom in
  'zoom-out': ZoomOut, // Example mapping for zoom out
};

// Function to get Lucide icon component from Font Awesome class
const getLucideIcon = (faClass?: string) => {
  if (!faClass) return Circle; // Default icon

  // Extract the icon name part (e.g., 'users' from 'fas fa-users')
  const nameMatch = faClass.match(/fa-([^ ]+)/);
  if (nameMatch && nameMatch[1]) {
    const iconName = nameMatch[1];
    // Look up in the map, return default if not found
    return iconMap[iconName] || Circle;
  }

  return Circle; // Default icon if class format is unexpected
};


export const Sidebar: React.FC = () => { // Removed clinicData prop for now, will use context later
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation(); // Hook to get current location

  // Retrieve clinicData from localStorage directly within the component for now
  // A better approach would be using React Context or a state management library
  const clinicData: ClinicData | null = JSON.parse(localStorage.getItem('clinicData') || 'null');


  useEffect(() => {
    const fetchMenu = async () => {
      if (!clinicData || !clinicData.code || typeof clinicData.id_permissao === 'undefined') {
        setError("Dados da clínica incompletos para carregar o menu.");
        setIsLoading(false);
        setMenuItems([]); // Clear menu if data is incomplete
        return;
      }

      setIsLoading(true);
      setError(null);
      setMenuItems([]); // Clear previous menu items

      const userPermissionLevel = parseInt(clinicData.id_permissao.toString(), 10);
      if (isNaN(userPermissionLevel)) {
           setError("Nível de permissão do usuário inválido.");
           setIsLoading(false);
           setMenuItems([]);
           return;
      }

      const menuWebhookUrl = `${N8N_BASE_URL}/webhook/df28c667-ff0d-436d-8b55-f03ccac8ba06`;
      console.log("Fetching menu from:", menuWebhookUrl);

      try {
        const response = await fetch(menuWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clinic_code: clinicData.code })
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Erro ${response.status}: ${text || response.statusText}`);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("Formato de menu inválido (esperado Array)");
        }

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

        // Sort by 'ordem'
        filteredItems.sort((a, b) => (a.ordem ?? Infinity) - (b.ordem ?? Infinity));

        setMenuItems(filteredItems);

      } catch (err: any) {
        console.error("Erro ao buscar menu:", err);
        setError(`Falha ao carregar menu: ${err.message}`);
        setMenuItems([]); // Clear menu on error
      } finally {
        setIsLoading(false);
      }
    };

    // Fetch menu only if clinicData is available
    if (clinicData && clinicData.code && typeof clinicData.id_permissao !== 'undefined') {
        fetchMenu();
    } else {
        // If clinicData is not available, clear menu and show error/loading state accordingly
        setIsLoading(false);
        setError("Faça login para ver o menu.");
        setMenuItems([]);
    }

  }, [clinicData?.code, clinicData?.id_permissao]); // Re-fetch menu if clinicData code or permission changes


  // Determine active menu item based on current route
  // This needs refinement based on how you map menu items to routes
  const getActive = (item: MenuItem) => {
      // Example: If item.id '1' corresponds to the dashboard route '/dashboard'
      if (item.id === '1' && location.pathname === '/dashboard') {
          return true;
      }
      // Add more logic here to match other menu items to routes
      // For now, only dashboard is explicitly handled
      return false;
  };


  return (
    // Sidebar container: fixed width, dark background, flex column
    // Added group class for hover effect
    <div className="group flex flex-col w-16 hover:w-64 bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center justify-center h-16 mt-4 mb-8 flex-shrink-0">
         {/* Replace with your logo component or img tag */}
         <img src="https://northclinic.com.br/assets/logo-drawer.png" alt="North Clinic Logo" className="h-10 w-10 object-contain group-hover:w-12 group-hover:h-12 transition-all duration-300" />
      </div>

      {/* Menu Items */}
      <nav className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center px-4 py-3 text-sidebar-foreground/70">
            <Loader2 className="h-5 w-5 mr-3 animate-spin" />
            {/* Removed opacity classes */}
            <span className="menu-text text-sm transition-opacity duration-300">Carregando...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center px-4 py-3 text-destructive">
            <TriangleAlert className="h-5 w-5 mr-3" />
             {/* Removed opacity classes */}
            <span className="menu-text text-sm transition-opacity duration-300">{error}</span>
          </div>
        )}

        {!isLoading && !error && menuItems.length === 0 && (
             <div className="flex items-center px-4 py-3 text-sidebar-foreground/70">
                <Circle className="h-5 w-5 mr-3" /> {/* Using a generic icon */}
                 {/* Removed opacity classes */}
                <span className="menu-text text-sm transition-opacity duration-300">Sem itens de menu</span>
             </div>
        )}

        {menuItems.map(item => {
            const IconComponent = getLucideIcon(item.icon_class);
            // Determine the target path for react-router-dom Link
            // This is a placeholder logic and needs to be refined based on your routing strategy
            // For now, let's assume item.id '1' maps to '/dashboard'
            // Other items might map to '/dashboard/:itemId' or specific paths
            const toPath = item.id === '1' ? '/dashboard' : `#${item.id}`; // Use # for now if not dashboard

            // If the item has a webhook_url and it's an external URL, we might not use Link
            // For simplicity, let's assume internal navigation for now, or handle external links separately
            const isExternal = item.webhook_url && item.webhook_url.startsWith('http');

            if (isExternal) {
                // Render as a standard anchor tag for external links
                 return (
                    <a
                        key={item.id}
                        href={item.webhook_url}
                        target="_blank" // Open external links in a new tab
                        rel="noopener noreferrer"
                        className="flex items-center px-4 py-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors duration-200"
                    >
                        <IconComponent className="h-5 w-5 mr-3 flex-shrink-0" />
                        {/* Removed opacity classes */}
                        <span className="menu-text text-sm transition-opacity duration-300">{item.label}</span>
                    </a>
                 );
            } else {
                // Render as a react-router-dom Link for internal navigation
                // The 'to' prop needs to be a valid internal path
                // For now, only dashboard is a real route. Others will be placeholders.
                const internalTo = item.id === '1' ? '/dashboard' : `/dashboard/${item.id}`; // Example: map other IDs to nested routes

                return (
                    <Link
                        key={item.id}
                        to={internalTo} // Use the determined internal path
                        className={`flex items-center px-4 py-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors duration-200 ${getActive(item) ? 'text-sidebar-primary bg-sidebar-accent border-l-4 border-sidebar-primary pl-[calc(1rem-4px)]' : ''}`}
                    >
                        <IconComponent className="h-5 w-5 mr-3 flex-shrink-0" />
                        {/* Removed opacity classes */}
                        <span className="menu-text text-sm transition-opacity duration-300">{item.label}</span>
                    </Link>
                );
            }
        })}
      </nav>
    </div>
  );
};