import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useTour } from './TourContext'
import styles from './TourOverlay.module.css'

const PAD = 10 // px around the spotlight hole

function getTooltipStyle(rect, vw, vh) {
  const cardW = Math.min(320, vw - 32)

  if (!rect) {
    // Centered modal
    return {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: cardW,
    }
  }

  const cx = rect.x + rect.w / 2
  let left = Math.max(16, Math.min(cx - cardW / 2, vw - cardW - 16))

  const spaceBelow = vh - (rect.y + rect.h + PAD)
  const spaceAbove = rect.y - PAD

  if (spaceBelow >= 160 || spaceBelow >= spaceAbove) {
    // Below the element
    return {
      position: 'fixed',
      top: rect.y + rect.h + PAD + 12,
      left,
      width: cardW,
    }
  }
  // Above the element
  return {
    position: 'fixed',
    bottom: vh - (rect.y - PAD - 12),
    left,
    width: cardW,
  }
}

function MapLegend({ t }) {
  return (
    <div className={styles.mapLegend}>
      <div className={styles.legendRow}>
        <div className={styles.miniPin}>♪</div>
        <span>{t('tour.map.legendVenue')}</span>
      </div>
      <div className={styles.legendRow}>
        <div className={`${styles.miniPin} ${styles.miniPinSpecial}`}>
          ♪
          <span className={styles.miniPinStar}>★</span>
        </div>
        <span>{t('tour.map.legendSpecial')}</span>
      </div>
      <div className={styles.legendRow}>
        <div className={styles.miniStandalone}>★</div>
        <span>{t('tour.map.legendStandalone')}</span>
      </div>
    </div>
  )
}

export default function TourOverlay() {
  const { t } = useTranslation()
  const { active, step, stepIdx, total, rect, tabRect, next, endTour } = useTour()

  if (!active || !step) return null

  const vw = window.innerWidth
  const vh = window.innerHeight
  const isLast = step.id === 'done'
  const isFirst = step.id === 'welcome'

  const holeX = rect ? rect.x - PAD : 0
  const holeY = rect ? rect.y - PAD : 0
  const holeW = rect ? rect.w + PAD * 2 : 0
  const holeH = rect ? rect.h + PAD * 2 : 0

  const tabPad = 6
  const tabHX = tabRect ? tabRect.x - tabPad : 0
  const tabHY = tabRect ? tabRect.y - tabPad : 0
  const tabHW = tabRect ? tabRect.w + tabPad * 2 : 0
  const tabHH = tabRect ? tabRect.h + tabPad * 2 : 0

  const tooltipStyle = getTooltipStyle(rect, vw, vh)

  return createPortal(
    <div className={styles.root}>
      {/* ── Dark overlay with spotlight hole ── */}
      <svg className={styles.overlay} onClick={undefined}>
        <defs>
          <mask id="tour-spotlight">
            <rect width="100%" height="100%" fill="white" />
            {rect && (
              <rect x={holeX} y={holeY} width={holeW} height={holeH} rx="14" fill="black" />
            )}
            {tabRect && (
              <rect x={tabHX} y={tabHY} width={tabHW} height={tabHH} rx="12" fill="black" />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.78)" mask="url(#tour-spotlight)" />
      </svg>


      {/* ── Tooltip card ── */}
      <div className={styles.card} style={tooltipStyle}>
        {/* Step counter */}
        {!isFirst && !isLast && (
          <div className={styles.counter}>
            {t('tour.step', { current: stepIdx, total: total - 2 })}
          </div>
        )}

        <h3 className={styles.title}>{t(`tour.${step.id}.title`)}</h3>
        <p  className={styles.desc}>{t(`tour.${step.id}.desc`)}</p>
        {step.id === 'map' && <MapLegend t={t} />}

        <div className={styles.actions}>
          {/* Close / skip all */}
          <button className={styles.skipBtn} onClick={endTour}>
            {t('tour.end')}
          </button>

          {/* Next / Finish */}
          <button className={styles.nextBtn} onClick={next}>
            {isLast ? t('tour.finish') : t('tour.next')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
