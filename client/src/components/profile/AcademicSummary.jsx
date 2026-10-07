import { AverageBars } from '../charts/AverageBars.jsx';
import { ProgressMeter } from '../charts/ProgressMeter.jsx';
import { SubjectTag } from '../ui/SubjectTag.jsx';
import { Section } from '../ui/Page.jsx';
import { formatAverage, gradeBand } from '../../utils/format.js';
import styles from './Profile.module.css';

// Asignaturas, notas, estadísticas y progreso: igual en el perfil propio y en el público.
export function AcademicSummary({ subjects = [], stats, subjectsAction }) {
  const graded = stats?.bySubject?.filter((row) => row.graded > 0) ?? [];
  return (
    <div className={styles.academicGrid}>
      <Section title="Asignaturas" id="profile-subjects" action={subjectsAction}>
        {subjects.length === 0 ? (
          <p className="muted small">Sin asignaturas todavía.</p>
        ) : (
          <ul className={styles.subjects}>
            {subjects.map((subject) => (
              <li key={subject._id}>
                <SubjectTag subject={subject} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {stats ? (
        <Section title="Rendimiento" id="profile-stats">
          <div className={styles.statsLine}>
            <span className={styles.statFigure}>{formatAverage(stats.average)}</span>
            <span className={styles.statText}>
              {stats.average != null ? `de media, ${gradeBand(stats.average).toLowerCase()}` : 'sin notas todavía'}
            </span>
          </div>
          {stats.totals ? (
            <ProgressMeter completed={stats.totals.completed} pending={stats.totals.pending} overdue={stats.totals.overdue} />
          ) : null}
          {graded.length ? (
            <div className={styles.bars}>
              <AverageBars rows={graded} overall={stats.average} />
            </div>
          ) : null}
        </Section>
      ) : null}
    </div>
  );
}
