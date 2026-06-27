import { Link } from "react-router-dom";

const STEPS = [
  {
    ico: "🃏",
    title: "A lapok",
    text: "Minden körben más számú lapot osztotok. A lapszám a maximumtól 1-ig csökken, majd vissza a maximumig — és vége a játéknak.",
  },
  {
    ico: "🎴",
    title: "Az adu",
    text: "Minden körnek van egy adu színe (néha épp nincs adu). Az adu bármelyik másik színt elüti.",
  },
  {
    ico: "🎯",
    title: "Tippelés",
    text: "Mindenki megtippeli, hány ütést fog vinni a körben. A tippek csak akkor derülnek ki, ha már MINDENKI rögzített.",
  },
  {
    ico: "🤚",
    title: "Lejátszás",
    text: "Lejátszátok a kört a kártyákkal, és megszámoljátok, ki hány ütést vitt.",
  },
  {
    ico: "🧮",
    title: "Számolás",
    text: "Beírjátok az eredményt, az app pedig automatikusan vezeti a pontokat körről körre.",
  },
];

export function Rules() {
  return (
    <div className="page">
      <header>
        <h1 className="brand">
          Hogyan kell <span>rikikizni?</span>
        </h1>
        <p className="tagline">
          A lényeg: találd el pontosan, hány ütést viszel a körben!
        </p>
      </header>

      <div className="suits">
        <span className="suit-chip s-black">♠︎</span>
        <span className="suit-chip s-red">♥</span>
        <span className="suit-chip s-black">♣</span>
        <span className="suit-chip s-red">♦</span>
        <span className="suit-chip s-none">∅</span>
      </div>

      <div className="card">
        <h2>A játék menete</h2>
        <ol className="rules-steps">
          {STEPS.map((s, i) => (
            <li className="rule-step" key={i}>
              <span className="step-ico">{s.ico}</span>
              <div className="step-body">
                <strong>
                  {i + 1}. {s.title}
                </strong>
                <p>{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="card">
        <h2>Pontozás</h2>
        <div className="score-rule good">
          <span className="score-ico">✅</span>
          <div className="step-body">
            <strong>Eltaláltad a tipped</strong>
            <p>+10 pont, és még +2 pont minden megnyert ütésért.</p>
          </div>
        </div>
        <div className="score-rule bad">
          <span className="score-ico">❌</span>
          <div className="step-body">
            <strong>Nem találtad el</strong>
            <p>−4 pont minden ütésnyi eltérésért (tipp ↔ valóság).</p>
          </div>
        </div>
        <p className="rules-eg">
          <strong>Pl.</strong> tipp 3, hozott 3 → <span className="eg-good">+16</span> · tipp 3,
          hozott 1 → <span className="eg-bad">−8</span>
        </p>
      </div>

      <Link to="/" className="btn">
        Értem, jöhet a játék! 🚀
      </Link>
    </div>
  );
}
