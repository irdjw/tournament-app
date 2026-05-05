import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import MatchSetup from './pages/bar/MatchSetup'
import Scoring from './pages/bar/Scoring'
import Scoreboard from './pages/display/Scoreboard'
import PlayerLookup from './pages/player/PlayerLookup'
import Standings from './pages/Standings'
import './App.css'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/bar/match-setup" element={<MatchSetup />} />
        <Route path="/bar/scoring/:matchId" element={<Scoring />} />
        <Route path="/display/scoreboard" element={<Scoreboard />} />
        <Route path="/player" element={<PlayerLookup />} />
        <Route path="/standings" element={<Standings />} />
      </Routes>
    </Router>
  )
}

export default App
