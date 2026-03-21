import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ScoresheetTypePage from './pages/ScoresheetTypePage';
import SetupPage from './pages/SetupPage';
import LineupPage from './pages/LineupPage';
import ScoringPage from './pages/ScoringPage';
import CifScoresheetViewPage from './pages/CifScoresheetViewPage';
import BetweenSetsPage from './pages/BetweenSetsPage';
import ScoresheetViewPage from './pages/ScoresheetViewPage';
import CalibrationPage from './pages/CalibrationPage';
import MatchLogPage from './pages/MatchLogPage';
import MatchHistoryPage from './pages/MatchHistoryPage';

export default function App() {
  return (
    <div className="min-h-full">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/scoresheet-type" element={<ScoresheetTypePage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/lineup/:setIndex" element={<LineupPage />} />
        <Route path="/scoring" element={<ScoringPage />} />
        <Route path="/cif-scoresheet" element={<CifScoresheetViewPage />} />
        <Route path="/between-sets" element={<BetweenSetsPage />} />
        <Route path="/scoresheet" element={<ScoresheetViewPage />} />
        <Route path="/match-log" element={<MatchLogPage />} />
        <Route path="/history" element={<MatchHistoryPage />} />
        <Route path="/calibrate" element={<CalibrationPage />} />
      </Routes>
    </div>
  );
}
