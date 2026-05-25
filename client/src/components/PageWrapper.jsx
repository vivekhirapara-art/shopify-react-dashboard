import { useLocation } from 'react-router-dom';

export default function PageWrapper({ children }) {
  const { pathname } = useLocation();

  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
