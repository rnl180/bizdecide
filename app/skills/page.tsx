import type { Metadata } from "next";
import { Icon } from "@/components/Icon";
import { readSkill, SKILLS } from "@/lib/skills";

export const metadata: Metadata = {
  title: "WorkBuddy skills · BizDecide",
  description: "Download BizDecide's CFO skills and import them into your own Tencent WorkBuddy.",
};

const STEPS = [
  ["download", "Download a skill", "Each skill is a .zip with SKILL.md inside. Get only the ones you need."],
  ["upload", "Import it into WorkBuddy", "Open Skills and choose Import (or Add skill, then Upload) and select the .zip."],
  ["shield", "Run it on your numbers", "WorkBuddy runs a security check first. Once it passes, ask WorkBuddy to use the skill."],
] as const;

export default async function SkillsPage() {
  const skills = await Promise.all(SKILLS.map(async (s) => ({ ...s, meta: await readSkill(s.id) })));
  const ready = skills.filter((s) => s.meta).length;

  return (
    <>
      <section className="hero-band">
        <div className="container page-hero">
          <span className="eyebrow">
            <Icon name="zap" size={14} /> For accountants and SME consultants
          </span>
          <h1>
            Run BizDecide inside <span className="hl">your own WorkBuddy</span>
          </h1>
          <p className="lede">
            Already use Tencent WorkBuddy? Download the same skills our CFO agents use and run them on your clients&apos; numbers.
          </p>
        </div>
      </section>

      <section className="container section">
        <ol className="install">
          {STEPS.map(([icon, title, body], i) => (
            <li key={title}>
              <span className="install-n">{i + 1}</span>
              <div>
                <strong>
                  <Icon name={icon} size={16} /> {title}
                </strong>
                <p>{body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="section-head" style={{ marginTop: 48 }}>
          <div className="kicker">Skills</div>
          <h2>Pick a skill</h2>
          <p className="muted">
            {ready} of {skills.length} ready to download.
          </p>
        </div>

        <div className="skill-grid">
          {skills.filter((s) => s.meta).map((s) => (
            <article className="card skill" key={s.id}>
              <div className="skill-top">
                <span className="service-icon">
                  <Icon name={s.icon} size={20} />
                </span>
                {s.meta?.version && <span className="pill done version">v{s.meta.version}</span>}
              </div>
              <h3>{s.title}</h3>
              <p className="muted">{s.blurb}</p>
              <dl className="skill-meta">
                <div>
                  <dt>Works on</dt>
                  <dd>{s.input}</dd>
                </div>
                <div>
                  <dt>Skill ID</dt>
                  <dd className="code">{s.id}</dd>
                </div>
              </dl>
              {s.meta ? (
                <a className="btn btn-primary" href={`/api/skills/${s.id}/download`} download>
                  <Icon name="download" size={16} /> Download .zip
                </a>
              ) : (
                <button className="btn btn-secondary" type="button" disabled>
                  Coming soon
                </button>
              )}
            </article>
          ))}
        </div>

        <div className="notice" style={{ marginTop: 24 }}>
          <Icon name="info" />
          <p>
            Imported skills stay in your own WorkBuddy space. Your enterprise admin can approve sharing them with the rest of your
            company.
          </p>
        </div>
      </section>
    </>
  );
}
