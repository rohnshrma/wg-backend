import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User';
import env from './env';

passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value?.toLowerCase();
        if (!email) {
          return done(new Error('Google account has no email'));
        }

        let user = await User.findOne({ googleId: profile.id });
        if (user) return done(null, user);

        // Link to an existing email/password account if one already exists.
        user = await User.findOne({ email });
        if (user) {
          user.googleId = profile.id;
          if (!user.isEmailVerified) user.isEmailVerified = true;
          await user.save({ validateBeforeSave: false });
          return done(null, user);
        }

        user = await User.create({
          email,
          googleId: profile.id,
          role: 'student',
          isEmailVerified: true,
        });
        return done(null, user);
      } catch (err) {
        return done(err as Error);
      }
    }
  )
);

export default passport;
