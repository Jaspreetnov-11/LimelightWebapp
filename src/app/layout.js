import './globals.css';
import { AuthProvider } from '@/controllers/AuthController';
import { UiProvider } from '@/controllers/UiController';
import { DataProvider } from '@/controllers/DataController';
import { IconSprite } from '@/views/ui/Icons';
import { FormModal, Toast } from '@/views/ui/FormModal';
import { SelfieModal } from '@/views/ui/SelfieModal';

export const metadata = {
  title: 'Limelight',
  description: 'Limelight workspace: staff, attendance, payroll, projects and tasks',
  manifest: '/manifest.json',
  icons: { icon: '/icon.svg' },
  appleWebApp: { capable: true, title: 'Limelight', statusBarStyle: 'black-translucent' }
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0A0A0B'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Patrick+Hand&display=swap" />
        {/* Apply the saved appearance before first paint so there is no dark/light flash */}
        <script dangerouslySetInnerHTML={{ __html: "try{if(localStorage.getItem('lh-theme')==='light'){document.documentElement.setAttribute('data-theme','light');}}catch(e){}" }} />
      </head>
      <body>
        <IconSprite />
        <AuthProvider>
          <UiProvider>
            <DataProvider>
              {children}
              <FormModal />
              <SelfieModal />
              <Toast />
            </DataProvider>
          </UiProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
