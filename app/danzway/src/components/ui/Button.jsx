import styles from './Button.module.css'

export default function Button({ children, variant = 'primary', onClick, disabled, as: Tag = 'button', href, ...rest }) {
  const className = [styles.btn, styles[variant]].join(' ')

  if (Tag === 'a' || href) {
    return (
      <a className={className} href={href} {...rest}>
        {children}
      </a>
    )
  }

  return (
    <button className={className} onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  )
}
