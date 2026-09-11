import { StaffProfileScreen } from '@/views/screens/StaffScreens';
export const metadata = { title: 'Staff · Limelight' };
export default async function Page({ params }) { const { id } = await params; return <StaffProfileScreen id={id} />; }
