import { motion } from "framer-motion";

function ProgressCards({ progress = [] }) { return <section className="dashboard-section" aria-labelledby="progress-title"><div className="dashboard-section__heading"><div><span className="eyebrow">Your gentle progress</span><h2 id="progress-title">The care you&apos;ve made space for</h2></div></div><div className="dashboard-progress">{progress.map((item, index) => <motion.article className="dashboard-progress__card" key={item.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: index * 0.06 }}><span>{item.label}</span><strong>{item.value}</strong><small>{item.detail}</small></motion.article>)}</div></section>; }

export default ProgressCards;
