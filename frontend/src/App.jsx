import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import VenueLayout from './pages/venue/VenueLayout'
import VenueHome from './pages/venue/VenueHome'
import LiveScores from './pages/venue/LiveScores'
import VenueStandings from './pages/venue/VenueStandings'
import VenueFixtures from './pages/venue/VenueFixtures'
import VenueTournament from './pages/venue/VenueTournament'
import VenueResults from './pages/venue/VenueResults'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import Players from './pages/admin/players/Players'
import PlayerDetail from './pages/admin/players/PlayerDetail'
import Leagues from './pages/admin/leagues/Leagues'
import LeagueNew from './pages/admin/leagues/LeagueNew'
import LeagueDetail from './pages/admin/leagues/LeagueDetail'
import Tournaments from './pages/admin/tournaments/Tournaments'
import TournamentAdmin from './pages/admin/tournaments/TournamentAdmin'
import MatchHistory from './pages/admin/history/MatchHistory'
import AdminStations from './pages/admin/stations/AdminStations'
import AdminSettings from './pages/admin/settings/AdminSettings'
import Home from './pages/Home'
import BarHome from './pages/bar/BarHome'
import MatchSetup from './pages/bar/MatchSetup'
import Scoring from './pages/bar/Scoring'
import BarSettings from './pages/bar/Settings'
import DisplayHome from './pages/display/DisplayHome'
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
import TournamentList from './pages/tournament/TournamentList'
import TournamentOverview from './pages/tournament/TournamentOverview'
import TournamentBracketPublic from './pages/tournament/TournamentBracketPublic'
import TournamentResultsPublic from './pages/tournament/TournamentResultsPublic'
import './App.css'

function App() {
  return (
    <Router>
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        <Route path="/" element={<Home />} />

        {/* Bar mode — requires auth */}
        <Route element={<ProtectedRoute />}>
          <Route path="/bar" element={<BarHome />} />
          <Route path="/bar/match-setup" element={<MatchSetup />} />
          <Route path="/bar/scoring/:matchId" element={<Scoring />} />
          <Route path="/bar/settings" element={<BarSettings />} />
          <Route path="/bar/league/setup" element={<LeagueSetup />} />
          <Route path="/bar/league/:fixtureId" element={<FixtureDetail />} />
          <Route path="/bar/league/round/:roundId" element={<RoundDetail />} />
          <Route path="/bar/stations" element={<Stations />} />
          <Route path="/bar/tournament/new" element={<NewTournament />} />
          <Route path="/bar/tournament/:id" element={<TournamentControl />} />
          <Route path="/bar/tournament/:id/bracket" element={<TournamentBracket />} />
        </Route>

        {/* Admin dashboard — requires auth */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/players" element={<Players />} />
            <Route path="/admin/players/:id" element={<PlayerDetail />} />
            <Route path="/admin/leagues" element={<Leagues />} />
            <Route path="/admin/leagues/new" element={<LeagueNew />} />
            <Route path="/admin/leagues/:id" element={<LeagueDetail />} />
            <Route path="/admin/tournaments" element={<Tournaments />} />
            <Route path="/admin/tournaments/:id" element={<TournamentAdmin />} />
            <Route path="/admin/history" element={<MatchHistory />} />
            <Route path="/admin/stations" element={<AdminStations />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
          </Route>
        </Route>

        {/* Venue public pages — no auth */}
        <Route path="/v/:slug" element={<VenueLayout />}>
          <Route index element={<VenueHome />} />
          <Route path="live" element={<LiveScores />} />
          <Route path="standings" element={<VenueStandings />} />
          <Route path="fixtures" element={<VenueFixtures />} />
          <Route path="results" element={<VenueResults />} />
          <Route path="tournament/:id" element={<VenueTournament />} />
        </Route>

        {/* Display mode — public */}
        <Route path="/display" element={<DisplayHome />} />
        <Route path="/display/scoreboard" element={<Scoreboard />} />
        <Route path="/display/stations" element={<StationsDisplay />} />
        <Route path="/display/tournament/:id" element={<TournamentDisplay />} />
        <Route path="/display/tournament/:id/brackets" element={<TournamentBracketsDisplay />} />
        <Route path="/display/tournament/:id/results" element={<TournamentResultsDisplay />} />
        {/* Player / public */}
        <Route path="/player" element={<PlayerLookup />} />
        <Route path="/standings" element={<Standings />} />
        <Route path="/standings/:fixtureId" element={<StandingsPublic />} />
        <Route path="/tournament" element={<TournamentList />} />
        <Route path="/tournament/:id" element={<TournamentOverview />} />
        <Route path="/tournament/:id/bracket" element={<TournamentBracketPublic />} />
        <Route path="/tournament/:id/results" element={<TournamentResultsPublic />} />
      </Routes>
    </Router>
  )
}

export default App
