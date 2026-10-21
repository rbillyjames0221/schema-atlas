import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Schema Atlas — Database Architecture Studio',description:'Edit, visualize and present relational database schemas. Prisma and SQL support.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
