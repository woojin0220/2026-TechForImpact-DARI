import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'quiet' };

/** Native button behaviour with one shared visual contract, including form association. */
export function Button({variant='secondary',className='',type='button',...props}:ButtonProps) {
 return <button {...props} type={type} className={`dari-button ${variant} ${className}`.trim()} />;
}

export function BackButton({label,className='',...props}:Omit<ButtonProps,'children'|'variant'> & {label:string}) {
 return <Button {...props} variant="quiet" aria-label={label} className={`dari-back ${className}`}>
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m14.5 5-7 7 7 7" /></svg>
  <span>{label}</span>
 </Button>;
}

/** Main screen title and trailing controls; callers own page navigation and content. */
export function ScreenHeader({title,actions,leading,className='',titleClassName=''}:{title:string;actions?:ReactNode;leading?:ReactNode;className?:string;titleClassName?:string}) {
 return <header className={`dari-screen-header ${className}`}>
  {leading&&<div className="dari-screen-leading">{leading}</div>}
  <h1 className={titleClassName}>{title}</h1>
  {actions&&<div className="dari-screen-actions">{actions}</div>}
 </header>;
}
