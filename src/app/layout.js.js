import './globals.css';

export const metadata = {
  title: 'Dashboard Monitoring Tunggakan Berkas',
  description: 'Sistem Pemantauan Berkas Tertunggak ATR/BPN',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}