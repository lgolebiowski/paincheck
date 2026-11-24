import { Navigate, Route, Routes } from 'react-router-dom';
import { History } from './screens/History';
import { PainCheck } from './screens/PainCheck';

export function App() {
  return (
    <div className="phone">
      <Routes>
        <Route path="/" element={<PainCheck />} />
        {/* Notifications delivered before the lock-screen screen was removed point here. */}
        <Route path="/check" element={<Navigate to="/" replace />} />
        <Route path="/history" element={<History />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
