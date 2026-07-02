import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLogin } from '../hooks/useLogin';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Mail, ChevronRight, LayoutDashboard, Factory, ShieldCheck, Sparkles, Activity, Eye, EyeOff } from 'lucide-react';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focusedInput, setFocusedInput] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  
  const { mutateAsync, isLoading, error } = useLogin();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await mutateAsync({ email, password });
      setIsExiting(true);
      // Wait for exit animation to complete before navigating
      setTimeout(() => {
        navigate('/dashboard');
      }, 600);
    } catch (err) {
      // Error is handled by hook
    }
  };

  return (
    <div className="h-screen w-full relative overflow-hidden bg-slate-950 text-slate-200 selection:bg-indigo-500/30 font-sans flex items-center justify-center">
      
      {/* Animated Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            x: [0, 100, 0],
            y: [0, -50, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 left-1/4 w-[40rem] h-[40rem] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen"
        />
        <motion.div
          animate={{
            x: [0, -80, 0],
            y: [0, 60, 0],
            scale: [1, 1.3, 1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-1/4 right-1/4 w-[35rem] h-[35rem] bg-violet-600/20 rounded-full blur-[120px] mix-blend-screen"
        />
        <motion.div
          animate={{
            x: [0, 50, 0],
            y: [0, 100, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 5 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[45rem] h-[45rem] bg-cyan-600/10 rounded-full blur-[150px] mix-blend-screen"
        />
      </div>

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAzNHYtNGgtMnY0aC00djJoNHY0aDJ2LTRoNHYtMmgtNHzmMC0zMFYwaC0ydjRoLTR2Mmg0djRoMnYtNGg0VjRoLTR6bS0zMCAwVjBoLTJ2NGgtNHYyaDR2NGgydi00aDRWNGgtNHptMCAzMHYtNGgtMnY0aC00djJoNHY0aDJ2LTRoNHYtMmgtNHoiIGZpbGw9IiM5QzkyQTMiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvZz48L3N2Zz4=')] opacity-50 pointer-events-none" />

      {/* Main Container with Exit Animation */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ 
          opacity: isExiting ? 0 : 1, 
          scale: isExiting ? 1.05 : 1, 
          filter: isExiting ? 'blur(10px)' : 'blur(0px)' 
        }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
        className="relative z-10 w-full h-full max-w-[1300px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row items-center justify-center gap-10 lg:gap-20"
      >
        
        {/* Left Side: Branding / Copy */}
        <motion.div 
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
          className="hidden lg:flex flex-col flex-1"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 w-fit mb-6 backdrop-blur-md shadow-lg">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-medium text-slate-200">Next-Gen Enterprise Resource Planning</span>
          </div>
          
          <h1 className="text-5xl xl:text-6xl font-black text-white leading-[1.15] tracking-tight mb-6">
            Intelligent <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400">
              Manufacturing
            </span>
            <br /> Platform
          </h1>
          
          <p className="text-lg text-slate-400 leading-relaxed mb-10 max-w-xl font-light">
            Streamline your production process, manage inventory in real-time, and leverage predictive analytics to scale your operations effortlessly.
          </p>

          <div className="grid grid-cols-2 gap-6 max-w-2xl">
            {[
              { icon: Factory, title: 'Smart Production', desc: 'Real-time floor monitoring' },
              { icon: ShieldCheck, title: 'Quality Control', desc: 'Automated compliance checks' },
              { icon: Activity, title: 'Live Analytics', desc: 'Data-driven insights' },
              { icon: LayoutDashboard, title: 'Unified View', desc: 'Centralized command center' }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 + (i * 0.1) }}
                className="flex items-start gap-4 group"
              >
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm text-indigo-400 group-hover:bg-indigo-500/10 group-hover:text-indigo-300 transition-colors shadow-lg">
                  <feature.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-200 text-base mb-0.5">{feature.title}</h3>
                  <p className="text-xs text-slate-500 leading-snug">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Right Side: Login Form */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="w-full max-w-md lg:max-w-[440px] lg:ml-auto"
        >
          <div className="relative group">
            {/* Ambient Glow behind card */}
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-500 rounded-[2.5rem] blur-2xl opacity-30 group-hover:opacity-50 transition duration-1000 group-hover:duration-500"></div>
            
            {/* Glassmorphic Card */}
            <div className="relative bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-8 sm:p-10 shadow-2xl overflow-hidden">
              
              {/* Inner card subtle top highlight */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
              {/* Animated top glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[40px] bg-indigo-500/20 blur-[40px] rounded-full pointer-events-none"></div>

              <div className="text-center mb-8 relative z-10">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-[1.25rem] bg-gradient-to-br from-indigo-500 to-violet-600 mb-6 shadow-[0_0_30px_rgba(99,102,241,0.5)] border border-white/10">
                  <Factory className="w-8 h-8 text-white drop-shadow-md" />
                </div>
                <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Welcome Back</h2>
                <p className="text-slate-400 text-sm">Enter your credentials to access your workspace</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, y: -10 }}
                      animate={{ opacity: 1, height: 'auto', y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -10 }}
                      className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-3 mb-4"
                    >
                      <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">Work Email</label>
                    <div className="relative">
                      <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-300 ${focusedInput === 'email' ? 'text-indigo-400' : 'text-slate-500'}`}>
                        <Mail className="h-5 w-5" />
                      </div>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onFocus={() => setFocusedInput('email')}
                        onBlur={() => setFocusedInput(null)}
                        required
                        placeholder="john.doe@company.com"
                        className="w-full pl-11 pr-4 py-3.5 bg-slate-950/60 border border-white/5 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-300 shadow-inner hover:bg-slate-950/80"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-medium text-slate-300 ml-1">Password</label>
                      <a href="#" className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors">Forgot Password?</a>
                    </div>
                    <div className="relative">
                      <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-300 ${focusedInput === 'password' ? 'text-indigo-400' : 'text-slate-500'}`}>
                        <Lock className="h-5 w-5" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={() => setFocusedInput('password')}
                        onBlur={() => setFocusedInput(null)}
                        required
                        placeholder="••••••••"
                        className="w-full pl-11 pr-12 py-3.5 bg-slate-950/60 border border-white/5 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-300 shadow-inner hover:bg-slate-950/80"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-indigo-400 transition-colors"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center mt-3 mb-6">
                  <input
                    id="remember-me"
                    type="checkbox"
                    className="w-4 h-4 rounded border-white/10 bg-slate-950/60 text-indigo-500 focus:ring-indigo-500/50 focus:ring-offset-0 cursor-pointer transition-colors"
                  />
                  <label htmlFor="remember-me" className="ml-2.5 block text-sm text-slate-400 cursor-pointer select-none hover:text-slate-300 transition-colors">
                    Remember me for 30 days
                  </label>
                </div>

                <motion.button
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.985 }}
                  type="submit"
                  disabled={isLoading}
                  className="relative w-full flex items-center justify-center py-3.5 px-8 border border-transparent text-base font-bold rounded-xl text-white bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_30px_rgba(99,102,241,0.4)] hover:shadow-[0_0_40px_rgba(99,102,241,0.6)] transition-all duration-300 group overflow-hidden"
                >
                  {/* Glossy overlay effect */}
                  <div className="absolute inset-0 bg-white/20 h-1/2 pointer-events-none rounded-t-xl" />
                  
                  {isLoading ? (
                    <div className="flex items-center gap-3 relative z-10">
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Authenticating...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 relative z-10">
                      Sign in to workspace
                      <ChevronRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
                    </div>
                  )}
                </motion.button>
              </form>
              
              <div className="mt-6 pt-5 border-t border-white/10 text-center relative z-10">
                <p className="text-sm text-slate-500">
                  Having trouble logging in? <br/>
                  <a href="#" className="font-medium text-slate-300 hover:text-white transition-colors mt-1 inline-block border-b border-transparent hover:border-white">Contact System Administrator</a>
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
      
      {/* Footer minimal */}
      <div className="absolute bottom-4 w-full text-center text-xs text-slate-600/80 hidden sm:block pointer-events-none">
        &copy; {new Date().getFullYear()} ERP. All rights reserved. Let's Build the Future.
      </div>
    </div>
  );
};

export default LoginPage;
