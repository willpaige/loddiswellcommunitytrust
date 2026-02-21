export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{`header[role="banner"], footer { display: none; } #main-content { padding: 0; }`}</style>
      {children}
    </>
  );
}
