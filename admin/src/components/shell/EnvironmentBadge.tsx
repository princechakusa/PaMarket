import { shellEnvironment } from '../../app/environment';
export function EnvironmentBadge() { return <span className="environment-badge" title={shellEnvironment.dataSource}><span aria-hidden="true" className="environment-dot" />{shellEnvironment.label}</span>; }
