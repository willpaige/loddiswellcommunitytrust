export default function AccountLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{`header[role="banner"], footer, .newsletter-signup { display: none; } #main-content { padding: 0; }`}</style>
      {children}
    </>
  );
}
