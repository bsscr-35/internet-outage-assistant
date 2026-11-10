import { AlertCircle, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import useAuth from '../contexts/useAuth'

function getErrorMessage(error) {
  return error.response?.data?.message || 'The account request could not be completed. Check the API connection and try again.'
}

export default function AuthPage({ mode }) {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [values, setValues] = useState({
    userName: '',
    email: '',
    password: '',
    department: '',
    contactInfo: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const isRegistration = mode === 'register'

  const handleChange = (event) => {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (isRegistration) {
        await register(values)
      } else {
        await login({ email: values.email, password: values.password })
      }
      navigate(location.state?.from?.pathname || '/', { replace: true })
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <section aria-labelledby="auth-title" className="panel auth-card">
        <div className="auth-icon"><ShieldCheck size={20} /></div>
        <div className="eyebrow">NETWORK OPERATIONS</div>
        <h2 id="auth-title">{isRegistration ? 'Create your account' : 'Welcome back'}</h2>
        <p>{isRegistration
          ? 'Create an account to report incidents and coordinate recovery.'
          : 'Sign in to report outages and update recovery progress.'}</p>

        {error && (
          <div className="inline-error auth-error" role="alert">
            <AlertCircle size={15} /> {error}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {isRegistration && (
            <label>
              <span>Name</span>
              <input autoComplete="name" maxLength={100} name="userName" onChange={handleChange} required value={values.userName} />
            </label>
          )}
          <label>
            <span>Email</span>
            <input autoComplete="email" maxLength={254} name="email" onChange={handleChange} required type="email" value={values.email} />
          </label>
          <label>
            <span>Password</span>
            <input
              autoComplete={isRegistration ? 'new-password' : 'current-password'}
              maxLength={128}
              minLength={isRegistration ? 8 : undefined}
              name="password"
              onChange={handleChange}
              required
              type="password"
              value={values.password}
            />
          </label>
          {isRegistration && (
            <>
              <label>
                <span>Department <small>Optional</small></span>
                <input maxLength={100} name="department" onChange={handleChange} value={values.department} />
              </label>
              <label>
                <span>Contact information <small>Optional</small></span>
                <input maxLength={150} name="contactInfo" onChange={handleChange} value={values.contactInfo} />
              </label>
            </>
          )}
          <button className="auth-submit" disabled={submitting} type="submit">
            {submitting ? 'Please wait…' : isRegistration ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <div className="auth-switch">
          {isRegistration ? 'Already have an account?' : 'New to the response assistant?'}
          {' '}
          <Link to={isRegistration ? '/login' : '/register'}>
            {isRegistration ? 'Sign in' : 'Create an account'}
          </Link>
        </div>
        <div className="auth-footnote">Passwords are stored as salted scrypt hashes. Existing user records are not modified.</div>
      </section>
    </div>
  )
}
