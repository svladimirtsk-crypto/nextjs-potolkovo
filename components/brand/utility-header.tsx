import Link from "next/link";
import { BrandLogo } from "./brand-logo";

/** Minimal header independent of calculator context, including error recovery. */
export function UtilityHeader() {
  return <header className="pk-utility-header"><div className="pk-wrap"><BrandLogo /><Link className="pk-utility-home" href="/">На главную <span aria-hidden="true">↗</span></Link></div></header>;
}
