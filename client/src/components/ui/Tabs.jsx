import * as RadixTabs from '@radix-ui/react-tabs';
import clsx from 'clsx';
import styles from './Tabs.module.css';

// Pestañas: la activa se marca con el fluorescente, como se subraya lo que importa.
export function Tabs({ value, onValueChange, tabs, children, className, listClassName, label }) {
  return (
    <RadixTabs.Root value={value} onValueChange={onValueChange} className={className}>
      <RadixTabs.List className={clsx(styles.list, listClassName)} aria-label={label}>
        {tabs.map((tab) => (
          <RadixTabs.Trigger key={tab.value} value={tab.value} className={styles.trigger}>
            {tab.icon ? <tab.icon size={18} aria-hidden /> : null}
            <span className={styles.label}>{tab.label}</span>
            {tab.count ? <span className={styles.count}>{tab.count}</span> : null}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {children}
    </RadixTabs.Root>
  );
}

export const TabPanel = ({ className, ...props }) => <RadixTabs.Content className={clsx(styles.panel, className)} {...props} />;

// Mismo aspecto que las pestañas pero para filtrar una lista (radio).
export function Segmented({ value, onChange, options, label }) {
  return (
    <div role="radiogroup" aria-label={label} className={styles.list}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          data-state={value === option.value ? 'active' : 'inactive'}
          className={clsx(styles.trigger, option.tone === 'alert' && styles.alert)}
          onClick={() => onChange(option.value)}
        >
          <span className={styles.label}>{option.label}</span>
          {option.count != null ? <span className={styles.count}>{option.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
