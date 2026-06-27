/**
 * Material Symbols (Google Material Icons) wrapper.
 *
 * Renders an icon by ligature name using the Material Symbols Rounded font
 * loaded in index.html. Sizing follows the font-size of the element; pass
 * `size` in px to scale. `filled` toggles the variable weight for the few
 * glyphs that look better solid.
 *
 * Icon names: https://fonts.google.com/icons (use the snake_case ligature).
 */
interface IconProps {
  name: string
  size?: number
  className?: string
  filled?: boolean
  style?: React.CSSProperties
  title?: string
  ariaHidden?: boolean
}

export default function Icon({
  name,
  size = 20,
  className,
  filled = false,
  style,
  title,
  ariaHidden
}: IconProps): JSX.Element {
  return (
    <span
      className={'material-symbols-rounded' + (className ? ' ' + className : '')}
      style={{ fontSize: size, fontVariationSettings: `'FILL' ${filled ? 1 : 0}`, ...style }}
      role={title ? 'img' : undefined}
      aria-hidden={ariaHidden ?? (title ? undefined : true)}
      aria-label={title}
      title={title}
    >
      {name}
    </span>
  )
}
