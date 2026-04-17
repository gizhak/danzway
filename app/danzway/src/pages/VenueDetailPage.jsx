import { useParams, Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectAllVenues } from '../store/venuesSlice'
import styles from './VenueDetailPage.module.css'

export default function VenueDetailPage() {
  const { placeId } = useParams()
  const venues      = useSelector(selectAllVenues)
  const venue       = venues.find((v) => v.placeId === placeId)

  if (!venue) {
    return (
      <div className={styles.notFound}>
        <p>Venue not found.</p>
        <Link to="/" className={styles.backLink}>← Back to feed</Link>
      </div>
    )
  }

  const {
    name,
    city,
    address,
    logo,
    photos = [],
    styles: danceStyles = [],
    categories = [],
    rating,
    reviewCount,
    reviews = [],
    phone,
    website,
    instagram,
    facebook,
    instagramPostUrl,
    coordinates,
  } = venue

  const heroImage  = logo ?? photos[0] ?? null
  const gallery    = photos.length > 0 ? photos : []
  const mapsUrl    = coordinates
    ? `https://www.google.com/maps/search/?api=1&query=${coordinates.lat},${coordinates.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + ' ' + (city ?? ''))}`

  // Strip leading @ if present
  const igHandle = instagram ? instagram.replace(/^@/, '').replace(/.*instagram\.com\//, '').replace(/\/$/, '') : null
  const fbHandle = facebook  ? facebook.replace(/^@/, '').replace(/.*facebook\.com\//, '').replace(/\/$/, '') : null

  return (
    <div className={styles.page}>

      {/* ── Back nav ── */}
      <Link to="/" className={styles.backBtn}>
        ← Dance Clubs
      </Link>

      {/* ── Hero ── */}
      <div className={styles.hero}>
        {heroImage ? (
          <img src={heroImage} alt={name} className={styles.heroImg} />
        ) : (
          <div className={styles.heroPlaceholder}>🎵</div>
        )}
        <div className={styles.heroOverlay} />

        {/* Name + city overlaid on hero */}
        <div className={styles.heroInfo}>
          <h1 className={styles.heroName}>{name}</h1>
          {city && <p className={styles.heroCity}>📍 {city}</p>}
        </div>
      </div>

      {/* ── Photo gallery strip ── */}
      {gallery.length > 1 && (
        <div className={styles.gallery}>
          {gallery.map((url, i) => (
            <img key={i} src={url} alt={`${name} photo ${i + 1}`} className={styles.galleryPhoto} loading="lazy" />
          ))}
        </div>
      )}

      {/* ── Details body ── */}
      <div className={styles.body}>

        {/* Dance styles */}
        {danceStyles.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionLabel}>Dance Styles</div>
            <div className={styles.styleRow}>
              {danceStyles.map((s) => (
                <span key={s} className={styles.styleChip}>{s}</span>
              ))}
            </div>
          </section>
        )}

        {/* Categories + rating */}
        <section className={styles.metaRow}>
          <div className={styles.metaLeft}>
            {categories.length > 0 && (
              <div className={styles.categoryRow}>
                {categories.slice(0, 3).map((c) => (
                  <span key={c} className={styles.categoryChip}>{c}</span>
                ))}
              </div>
            )}
            {address && <p className={styles.address}>{address}</p>}
          </div>
          {rating && (
            <div className={styles.ratingBlock}>
              <span className={styles.ratingNum}>{rating.toFixed(1)}</span>
              <span className={styles.ratingStar}>★</span>
              {reviewCount > 0 && (
                <span className={styles.ratingCount}>{reviewCount.toLocaleString()} reviews</span>
              )}
            </div>
          )}
        </section>

        {/* Contact & map */}
        <section className={styles.section}>
          <div className={styles.sectionLabel}>Contact & Directions</div>
          <div className={styles.contactList}>
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={styles.contactBtn}>
              <span className={styles.contactIcon}>🗺</span>
              Open in Google Maps
            </a>
            {phone && (
              <a href={`tel:${phone}`} className={styles.contactBtn}>
                <span className={styles.contactIcon}>📞</span>
                {phone}
              </a>
            )}
            {website && !instagram?.includes('instagram') && !website.includes('facebook') && (
              <a href={website} target="_blank" rel="noopener noreferrer" className={styles.contactBtn}>
                <span className={styles.contactIcon}>🌐</span>
                Website
              </a>
            )}
          </div>
        </section>

        {/* Social media */}
        {(igHandle || fbHandle) && (
          <section className={styles.section}>
            <div className={styles.sectionLabel}>Follow Us</div>
            <div className={styles.socialRow}>
              {igHandle && (
                <a
                  href={`https://instagram.com/${igHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialBtn}
                >
                  <span className={styles.socialIcon}>📸</span>
                  @{igHandle}
                </a>
              )}
              {fbHandle && (
                <a
                  href={`https://facebook.com/${fbHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.socialBtn} ${styles.socialBtnFb}`}
                >
                  <span className={styles.socialIcon}>👍</span>
                  {fbHandle}
                </a>
              )}
            </div>
          </section>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionLabel}>What people say</div>
            <div className={styles.reviewList}>
              {reviews.map((r, i) => (
                <div key={i} className={styles.review}>
                  <div className={styles.reviewHeader}>
                    {r.authorPhoto ? (
                      <img src={r.authorPhoto} alt={r.author} className={styles.reviewAvatar} />
                    ) : (
                      <div className={styles.reviewAvatarFallback}>
                        {r.author?.[0]?.toUpperCase() ?? '?'}
                      </div>
                    )}
                    <div className={styles.reviewMeta}>
                      <span className={styles.reviewAuthor}>{r.author}</span>
                      <span className={styles.reviewTime}>{r.relativeTime}</span>
                    </div>
                    {r.rating && (
                      <span className={styles.reviewStars}>
                        {'★'.repeat(Math.min(r.rating, 5))}
                      </span>
                    )}
                  </div>
                  {r.text && <p className={styles.reviewText}>{r.text}</p>}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

    </div>
  )
}
