import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export default function Home() {
  useDocumentTitle('DartScore — The pub sports app your venue actually needs')

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="border-b border-gray-800/50">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <span className="font-bold text-white text-lg tracking-tight">DartScore</span>
          <div className="flex items-center gap-4">
            <Link to="/v/southfield" className="text-sm text-gray-400 hover:text-white transition-colors hidden sm:block">Demo</Link>
            <Link to="/login" className="text-sm text-gray-400 hover:text-white transition-colors">Login</Link>
            <Link
              to="/onboarding"
              className="text-sm bg-purple-600 hover:bg-purple-500 text-white px-4 py-1.5 rounded-lg transition-colors font-medium"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-5 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-purple-900/30 border border-purple-800/50 text-purple-300 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
          <span className="w-1.5 h-1.5 bg-purple-400 rounded-full" />
          Now in early access
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-5 text-white">
          The pub sports app your<br className="hidden sm:block" /> venue actually needs
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
          Live scoring, league tables, tournaments — darts and pool, all in one place. From £2 a week.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/onboarding"
            className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold text-base transition-colors"
          >
            Get Started
          </Link>
          <Link
            to="/v/southfield"
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-semibold text-base transition-colors"
          >
            See a Live Demo
          </Link>
        </div>

        {/* TV Display Mockup */}
        <div className="mt-14 mx-auto max-w-2xl">
          <div className="relative rounded-2xl overflow-hidden bg-gray-900 border border-gray-800 shadow-2xl">
            <div className="bg-gray-950 px-4 pt-4 pb-2">
              <div className="w-8 h-1 bg-gray-700 rounded-full mx-auto mb-3" />
              <div className="bg-gray-950 rounded-xl overflow-hidden border border-gray-800">
                <div className="bg-gray-900 px-4 py-3 flex items-center justify-between border-b border-gray-800">
                  <span className="text-xs text-gray-400 font-medium">The Southfield Arms</span>
                  <span className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-ping" />
                    Live
                  </span>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3">
                  {[
                    { board: 'Board 1', p1: 'Dave', p2: 'Steve', s1: 180, s2: 94, l1: '2', l2: '1' },
                    { board: 'Board 2', p1: 'Mike', p2: 'Chris', s1: 301, s2: 262, l1: '1', l2: '1' },
                  ].map(m => (
                    <div key={m.board} className="bg-gray-800 rounded-lg overflow-hidden">
                      <div className="px-3 py-1.5 bg-gray-700/50 text-xs text-gray-400 font-medium">{m.board}</div>
                      <div className="px-3 py-2 space-y-1.5">
                        {[
                          { name: m.p1, score: m.s1, legs: m.l1 },
                          { name: m.p2, score: m.s2, legs: m.l2 },
                        ].map((p, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <span className="text-xs text-white font-medium">{p.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400 tabular-nums">{p.score}</span>
                              <span className="text-sm font-bold text-purple-300 w-3 text-right tabular-nums">{p.legs}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="h-3 bg-gray-800 flex items-center justify-center">
              <div className="w-12 h-1 bg-gray-700 rounded-full" />
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-3">Live scores display — runs on any TV or monitor</p>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-900/50 border-y border-gray-800">
        <div className="max-w-5xl mx-auto px-5 py-16">
          <h2 className="text-2xl font-bold text-white text-center mb-10">Three modes, one app</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                icon: '📱',
                title: 'Bar Mode',
                desc: 'Run your league night from a tablet. Big buttons, instant scoring. No training needed.',
              },
              {
                icon: '📺',
                title: 'Display Mode',
                desc: 'Live scores on your pub TV. Looks like the real thing. Plug in any browser.',
              },
              {
                icon: '👁️',
                title: 'Spectator Mode',
                desc: "Players follow live on their phones. Share with one link. No app download.",
              },
            ].map(f => (
              <div key={f.title} className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-base font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sports */}
      <section className="max-w-5xl mx-auto px-5 py-16">
        <h2 className="text-2xl font-bold text-white text-center mb-10">Built for the sports you play</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl mx-auto">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="text-2xl mb-3">🎯</div>
            <h3 className="font-semibold text-white mb-3">Darts</h3>
            <ul className="space-y-1.5">
              {['Legs, sets, 501 & 301', 'Averages & 180s', 'Single & double elimination', 'Round-robin leagues'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-400">
                  <span className="text-green-400 shrink-0">✓</span>{f}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="text-2xl mb-3">🎱</div>
            <h3 className="font-semibold text-white mb-3">Pool</h3>
            <ul className="space-y-1.5">
              {['Frames, 8-ball & 9-ball', 'League tables', 'Tournament brackets', 'Live scoring'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-400">
                  <span className="text-green-400 shrink-0">✓</span>{f}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="text-center text-sm text-gray-600 mt-6">More sports coming soon</p>
      </section>

      {/* Pricing */}
      <section className="bg-gray-900/50 border-y border-gray-800">
        <div className="max-w-5xl mx-auto px-5 py-16 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Simple pricing</h2>
          <p className="text-gray-400 mb-10">One venue, one price. No per-player fees.</p>
          <div className="max-w-md mx-auto bg-gray-900 border border-purple-800/50 rounded-2xl p-8">
            <div className="text-4xl font-bold text-white mb-1">
              £8<span className="text-xl font-normal text-gray-400">/mo</span>
            </div>
            <div className="text-sm text-gray-500 mb-1">or £80/yr — save two months</div>
            <div className="text-xs text-purple-400 font-medium mb-6">Start free — first month on us</div>
            <ul className="space-y-3 text-left mb-8">
              {[
                'Unlimited players',
                'All formats (leagues, tournaments, friendly)',
                'Bar, Display & Spectator modes',
                'Live scores & standings',
                'Public venue page',
                'QR codes & shareable links',
              ].map(f => (
                <li key={f} className="flex items-center gap-3 text-sm text-gray-300">
                  <span className="text-purple-400 shrink-0">✓</span>{f}
                </li>
              ))}
            </ul>
            <Link
              to="/onboarding"
              className="block w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold text-sm transition-colors text-center"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-5 py-16">
        <h2 className="text-2xl font-bold text-white text-center mb-10">Up and running in minutes</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl mx-auto">
          {[
            { step: '1', title: 'Sign up your venue', desc: '2 minutes. Name, email, password — done.' },
            { step: '2', title: 'Add your players and set up your league', desc: 'Import a list of names, create your fixture nights.' },
            { step: '3', title: "Run tonight's match", desc: 'Open Bar Mode on any tablet. It just works.' },
          ].map(s => (
            <div key={s.step} className="text-center">
              <div className="w-10 h-10 rounded-full bg-purple-900/50 border border-purple-700/50 text-purple-300 font-bold text-lg flex items-center justify-center mx-auto mb-4">
                {s.step}
              </div>
              <h3 className="font-semibold text-white mb-2 text-sm">{s.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-10">
          <Link
            to="/onboarding"
            className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold text-base transition-colors"
          >
            Get Started
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800">
        <div className="max-w-5xl mx-auto px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="font-bold text-white">DartScore</span>
            <span className="text-gray-600 text-sm ml-3">Built for pub sport, not esports</span>
          </div>
          <div className="flex items-center gap-5 text-sm text-gray-500">
            <Link to="/v/southfield" className="hover:text-gray-300 transition-colors">Demo</Link>
            <Link to="/login" className="hover:text-gray-300 transition-colors">Login</Link>
            <a href="mailto:hello@dartscore.app" className="hover:text-gray-300 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
