import * as Dropdown from "@radix-ui/react-dropdown-menu";
import * as RadixTooltip from "@radix-ui/react-tooltip";
import clsx from "clsx";

// Menú contextual. items: [{ label, icon, onSelect, tone, disabled }] o 'separator'.
export function Menu({ trigger, items, align = "end" }) {
  return (
    <Dropdown.Root modal={false}>
      <Dropdown.Trigger asChild>{trigger}</Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          className="menu"
          align={align}
          sideOffset={6}
          collisionPadding={12}
        >
          {items.filter(Boolean).map((item, index) =>
            item === "separator" ? (
              <Dropdown.Separator
                key={`separator-${index}`}
                className="menu-separator"
              />
            ) : (
              <Dropdown.Item
                key={item.label}
                className={clsx(
                  "menu-item",
                  item.tone === "danger" && "menu-danger",
                )}
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

export function Tooltip({
  content,
  children,
  side = "right",
  disabled = false,
}) {
  if (disabled || !content) return children;
  return (
    <RadixTooltip.Root delayDuration={250}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={8}
          className="menu-tooltip"
        >
          {content}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}

export const TooltipProvider = RadixTooltip.Provider;
