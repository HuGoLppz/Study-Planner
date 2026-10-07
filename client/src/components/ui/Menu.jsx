import * as Dropdown from '@radix-ui/react-dropdown-menu';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import clsx from 'clsx';
import styles from './Menu.module.css';

// Menú contextual. items: [{ label, icon, onSelect, tone, disabled }] o 'separator'.
export function Menu({ trigger, items, align = 'end' }) {
  return (
    <Dropdown.Root modal={false}>
      <Dropdown.Trigger asChild>{trigger}</Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content className={styles.menu} align={align} sideOffset={6} collisionPadding={12}>
          {items.filter(Boolean).map((item, index) =>
            item === 'separator' ? (
              <Dropdown.Separator key={`separator-${index}`} className={styles.separator} />
            ) : (
              <Dropdown.Item
                key={item.label}
                className={clsx(styles.item, item.tone === 'danger' && styles.danger)}
                onSelect={item.onSelect}
                disabled={item.disabled}
              >
                {item.icon ? <item.icon size={18} aria-hidden /> : null}
                {item.label}
              </Dropdown.Item>
            ),
          )}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

export function Tooltip({ content, children, side = 'right', disabled = false }) {
  if (disabled || !content) return children;
  return (
    <RadixTooltip.Root delayDuration={250}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content side={side} sideOffset={8} className={styles.tooltip}>
          {content}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}

export const TooltipProvider = RadixTooltip.Provider;
