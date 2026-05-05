import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import MatchSetup from './pages/bar/MatchSetup'
import Scoring from './pages/bar/Scoring'
import Scoreboard from './pages/display/Scoreboard'
import PlayerLookup from './pages/player/PlayerLookup'
import Standings from './pages/Standings'
import LeagueSetup from './pages/bar/league/Setup'
import FixtureDetail from './pages/bar/league/FixtureDetail'
import RoundDetail from './pages/bar/league/RoundDetail'
import StandingsPublic from './pages/StandingsPublic'
import Stations from './pages/bar/Stations'
import StationsDisplay from './pages/display/StationsDisplay'
import NewTournament from './pages/bar/tournament/NewTournament'
import TournamentControl from './pages/bar/tournament/TournamentControl'
import TournamentBracket from './pages/bar/tournament/TournamentBracket'
import TournamentDisplay from './pages/display/TournamentDisplay'
import TournamentBracketsDisplay from './pages/display/TournamentBracketsDisplay'
import TournamentResultsDisplay from './pages/display/TournamentResultsDisplay'
import './App.css'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/bar/match-setup" element={<MatchSetup />} />
        <Route path="/bar/scoring/:matchId" element={<Scoring />} />
        <Route path="/bar/league/setup" element={<LeagueSetup />} />
        <Route path="/bar/league/:fixtureId" element={<FixtureDetail />} />
        <Route path="/bar/league/round/:roundId" element={<RoundDetail />} />
        <Route path="/bar/stations" element={<Stations />} />
        <Route path="/bar/tournament/new" element={<NewTournament />} />
        <Route path="/bar/tournament/:id" element={<TournamentControl />} />
        <Route path="/bar/tournament/:id/bracket" element={<TournamentBracket />} />
        <Route path="/display/scoreboard" element={<Scoreboard />} />
        <Route path="/display/stations" element={<StationsDisplay />} />
        <Route path="/display/tournament/:id" element={<TournamentDisplay />} />
        <Route path="/display/tournament/:id/brackets" element={<TournamentBracketsDisplay />} />
        <Route path="/display/tournament/:id/results" element={<TournamentResultsDisplay />} />
        <Route path="/player" element={<PlayerLookup />} />
        <Route path="/standings" element={<Standings />} />
        <Route path="/standings/:fixtureId" element={<StandingsPublic />} />
      </Routes>
    </Router>
  )
}

export default App
