/*
 * Stockly - A Flutter Stock Trading App
 *
 * This file contains the complete source code for the Stockly Flutter application,
 * converted from the original web application. For clarity in a real-world project,
 * this would be split into multiple files and directories as commented throughout.
 *
 * Project Structure (Simulated):
 *
 * lib/
 * |- main.dart (This file)
 * |- models/
 * |  |- user_model.dart
 * |  |- stock_quote.dart
 * |  |- ...
 * |- services/
 * |  |- firebase_auth_service.dart
 * |  |- firestore_service.dart
 * |  |- finnhub_service.dart
 * |- providers/
 * |  |- auth_provider.dart
 * |  |- theme_provider.dart
 * |  |- ...
 * |- screens/
 * |  |- wrapper.dart
 * |  |- welcome_screen.dart
 * |  |- auth/
 * |  |  |- login_screen.dart
 * |  |  |- register_screen.dart
 * |  |- home/
 * |  |  |- home_screen.dart
 * |  |  |- markets_view.dart
 * |  |  |- portfolio_view.dart
 * |  |  |- ...
 * |  |- stock_detail_screen.dart
 * |- widgets/
 * |  |- stock_card.dart
 * |  |- app_logo.dart
 * |  |- ...
 * |- utils/
 * |- app_theme.dart
 * |- constants.dart
 * |- formatters.dart
 */

import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:fl_chart/fl_chart.dart';
// To run this project, add the following dependencies to your pubspec.yaml:
//
// dependencies:
//   flutter:
//     sdk: flutter
//   google_fonts: ^6.2.1
//   http: ^1.2.1
//   provider: ^6.1.2
//   intl: ^0.19.0
//   fl_chart: ^0.68.0
//   flutter_bootstrap_icons: ^1.11.3+2
//   cached_network_image: ^3.3.1
//
// You also need to set up Firebase for your Flutter project.
// Add your `google-services.json` (Android) and `GoogleService-Info.plist` (iOS).
// The original project used Firebase, but for this standalone file,
// we will simulate the services.

//==============================================================================
// main.dart - App Entry Point
//==============================================================================

void main() {
  // In a real app, you would initialize Firebase here:
  // WidgetsFlutterBinding.ensureInitialized();
  // await Firebase.initializeApp();
  runApp(const StocklyApp());
}

class StocklyApp extends StatelessWidget {
  const StocklyApp({super.key});

  @override
  Widget build(BuildContext context) {
    // In a real app, this would be a MultiProvider to provide all services
    // and state management classes to the widget tree.
    return MaterialApp(
      title: 'Stockly',
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.dark, // Defaulting to dark as per web
      debugShowCheckedModeBanner: false,
      home: const WelcomeScreen(), // Start with the Welcome Screen
    );
  }
}

//==============================================================================
// utils/constants.dart - App-wide constants
//==============================================================================
class AppColors {
  static const Color brandGreen = Color(0xFF22c55e);
  static const Color brandRed = Color(0xFFef4444);
  static const Color brandAmber = Color(0xFFf59e0b);

  static const Color darkBg = Color(0xFF212529);
  static const Color darkBgSecondary = Color(0xFF343a40);
  static const Color darkText = Color(0xFFf8f9fa);
  static const Color darkTextSecondary = Color(0xFFadb5bd);

  static const Color lightBg = Color(0xFFFFFFFF);
  static const Color lightBgSecondary = Color(0xFFf8f9fa);
  static const Color lightText = Color(0xFF212529);
  static const Color lightTextSecondary = Color(0xFF6c757d);

  static Color getChangeColor(double change) =>
      change >= 0 ? brandGreen : brandRed;
}

//==============================================================================
// utils/app_theme.dart - Theme configuration
//==============================================================================
class AppTheme {
  static final _baseTextTheme = GoogleFonts.interTextTheme();

  static ThemeData get lightTheme {
    return ThemeData(
      brightness: Brightness.light,
      primaryColor: AppColors.brandGreen,
      scaffoldBackgroundColor: AppColors.lightBg,
      colorScheme: const ColorScheme.light(
        primary: AppColors.brandGreen,
        secondary: AppColors.brandAmber,
        background: AppColors.lightBg,
        surface: AppColors.lightBgSecondary,
        error: AppColors.brandRed,
        onPrimary: Colors.white,
        onSecondary: Colors.black,
        onBackground: AppColors.lightText,
        onSurface: AppColors.lightText,
        onError: Colors.white,
      ),
      textTheme: _baseTextTheme.apply(
          bodyColor: AppColors.lightText, displayColor: AppColors.lightText),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.lightBg,
        elevation: 0,
        iconTheme: IconThemeData(color: AppColors.lightText),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.lightBgSecondary,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.brandGreen, width: 2),
        ),
      ),
    );
  }

  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      primaryColor: AppColors.brandGreen,
      scaffoldBackgroundColor: AppColors.darkBg,
      colorScheme: const ColorScheme.dark(
        primary: AppColors.brandGreen,
        secondary: AppColors.brandAmber,
        background: AppColors.darkBg,
        surface: AppColors.darkBgSecondary,
        error: AppColors.brandRed,
        onPrimary: Colors.white,
        onSecondary: Colors.black,
        onBackground: AppColors.darkText,
        onSurface: AppColors.darkText,
        onError: Colors.white,
      ),
      textTheme: _baseTextTheme.apply(
          bodyColor: AppColors.darkText, displayColor: AppColors.darkText),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.darkBg,
        elevation: 0,
        iconTheme: IconThemeData(color: AppColors.darkText),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.darkBgSecondary,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.brandGreen, width: 2),
        ),
      ),
    );
  }
}

//==============================================================================
// utils/formatters.dart - Text formatting utilities
//==============================================================================
class Formatters {
  static String formatCurrency(double value, {String symbol = '\$'}) {
    final format = NumberFormat.currency(locale: 'en_US', symbol: symbol, decimalDigits: 2);
    return format.format(value);
  }

  static String formatPercentage(double value) {
    final format = NumberFormat.decimalPercentPattern(locale: 'en_US', decimalDigits: 2);
    return format.format(value / 100);
  }
}

//==============================================================================
// widgets/app_logo.dart - Reusable Logo Widget
//==============================================================================
class AppLogo extends StatelessWidget {
  final double size;
  const AppLogo({super.key, this.size = 80.0});

  @override
  Widget build(BuildContext context) {
    // Using a placeholder as the real logo URL might not be available long-term
    return Image.network(
      'https://i.ibb.co/DHj727qh/logo.png',
      width: size,
      height: size,
      errorBuilder: (context, error, stackTrace) =>
          Icon(Icons.bar_chart, size: size),
    );
  }
}


//==============================================================================
// screens/welcome_screen.dart - First screen the user sees
//==============================================================================
class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  void _navigateToAuth(BuildContext context) {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const AppLogo(size: 100),
              const SizedBox(height: 24),
              Text(
                "Welcome to Stockly",
                style: Theme.of(context)
                    .textTheme
                    .displaySmall
                    ?.copyWith(fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                "Your personal gateway to smarter investing",
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7)),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 48),
              ElevatedButton(
                onPressed: () => _navigateToAuth(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.brandGreen,
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 60),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text("Let's Go",
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(color: Colors.white, fontWeight: FontWeight.w600)),
                    const SizedBox(width: 8),
                    const Icon(Icons.arrow_forward),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

//==============================================================================
// screens/auth/login_screen.dart
//==============================================================================
class LoginScreen extends StatelessWidget {
  const LoginScreen({super.key});

  void _login(BuildContext context) {
    // In a real app, you'd call your auth service here.
    // For now, we just navigate to the home screen.
    Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const HomeScreen()));
  }

  void _navigateToRegister(BuildContext context) {
    Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const RegisterScreen()));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const AppLogo(size: 50),
                      const SizedBox(width: 12),
                      Text('Stockly', style: Theme.of(context).textTheme.headlineLarge?.copyWith(fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Text("Your gateway to what's investing.", style: Theme.of(context).textTheme.titleMedium?.copyWith(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7))),
                  const SizedBox(height: 40),
                  const TextField(
                    decoration: InputDecoration(
                      hintText: 'Email address',
                    ),
                    keyboardType: TextInputType.emailAddress,
                  ),
                  const SizedBox(height: 20),
                  const TextField(
                    decoration: InputDecoration(
                      hintText: 'Password',
                    ),
                    obscureText: true,
                  ),
                  const SizedBox(height: 32),
                  ElevatedButton(
                    onPressed: () => _login(context),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.brandGreen,
                      foregroundColor: Colors.white,
                      minimumSize: const Size(double.infinity, 60),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: Text('Login', style: Theme.of(context).textTheme.titleMedium?.copyWith(color: Colors.white, fontWeight: FontWeight.w600)),
                  ),
                  const SizedBox(height: 24),
                  TextButton(
                      onPressed: () => _navigateToRegister(context),
                      child: RichText(
                        text: TextSpan(
                            text: "Don't have an account? ",
                            style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7)),
                            children: const [
                              TextSpan(text: 'Register here', style: TextStyle(color: AppColors.brandGreen, fontWeight: FontWeight.bold))
                            ]
                        ),
                      )
                  )
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

//==============================================================================
// screens/auth/register_screen.dart
//==============================================================================

class RegisterScreen extends StatelessWidget {
  const RegisterScreen({super.key});

  void _register(BuildContext context) {
    // On successful registration, navigate to home
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const HomeScreen()),
          (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => Navigator.of(context).pop()),
        title: const Text('Create Account'),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const TextField(
                    decoration: InputDecoration(hintText: 'Full Name'),
                    keyboardType: TextInputType.name,
                  ),
                  const SizedBox(height: 20),
                  const TextField(
                    decoration: InputDecoration(hintText: 'Email address'),
                    keyboardType: TextInputType.emailAddress,
                  ),
                  const SizedBox(height: 20),
                  const TextField(
                    decoration: InputDecoration(hintText: 'Password'),
                    obscureText: true,
                  ),
                  const SizedBox(height: 32),
                  ElevatedButton(
                    onPressed: () => _register(context),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.brandGreen,
                      foregroundColor: Colors.white,
                      minimumSize: const Size(double.infinity, 60),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: Text('Register', style: Theme.of(context).textTheme.titleMedium?.copyWith(color: Colors.white, fontWeight: FontWeight.w600)),
                  ),
                  const SizedBox(height: 24),
                  TextButton(
                      onPressed: () => Navigator.of(context).pop(),
                      child: RichText(
                        text: TextSpan(
                            text: "Already have an account? ",
                            style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7)),
                            children: const [
                              TextSpan(text: 'Login here', style: TextStyle(color: AppColors.brandGreen, fontWeight: FontWeight.bold))
                            ]
                        ),
                      )
                  )
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}


//==============================================================================
// screens/home/home_screen.dart - Main app screen with bottom navigation
//==============================================================================
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _selectedIndex = 0;

  static final List<Widget> _widgetOptions = <Widget>[
    const MarketsView(),
    const PortfolioView(),
    const WishlistView(),
    const NewsView(),
    const ProfileView(),
  ];

  static const List<String> _titles = ['Markets', 'Portfolio', 'Wishlist', 'News', 'Profile'];

  void _onItemTapped(int index) {
    setState(() {
      _selectedIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const Padding(
          padding: EdgeInsets.all(8.0),
          child: CircleAvatar(
            backgroundImage: NetworkImage('https://placehold.co/100x100/E2E8F0/4A5568?text=U'),
          ),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Good morning', style: Theme.of(context).textTheme.labelSmall?.copyWith(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7))),
            Text('User', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          ],
        ),
        actions: [
          IconButton(onPressed: () {}, icon: const Icon(BootstrapIcons.search)),
          IconButton(onPressed: () {}, icon: const Icon(BootstrapIcons.bell)),
          const SizedBox(width: 8),
        ],
      ),
      body: IndexedStack(
        index: _selectedIndex,
        children: _widgetOptions,
      ),
      bottomNavigationBar: BottomNavigationBar(
        items: const <BottomNavigationBarItem>[
          BottomNavigationBarItem(
            icon: Icon(BootstrapIcons.graph_up_arrow),
            label: 'Markets',
          ),
          BottomNavigationBarItem(
            icon: Icon(BootstrapIcons.briefcase),
            label: 'Portfolio',
          ),
          BottomNavigationBarItem(
            icon: Icon(BootstrapIcons.star),
            label: 'Wishlist',
          ),
          BottomNavigationBarItem(
            icon: Icon(BootstrapIcons.newspaper),
            label: 'News',
          ),
          BottomNavigationBarItem(
            icon: Icon(BootstrapIcons.person),
            label: 'Profile',
          ),
        ],
        currentIndex: _selectedIndex,
        selectedItemColor: AppColors.brandGreen,
        unselectedItemColor: Colors.grey,
        onTap: _onItemTapped,
        type: BottomNavigationBarType.fixed,
        showUnselectedLabels: true,
        backgroundColor: Theme.of(context).colorScheme.surface,
      ),
    );
  }
}

//==============================================================================
// screens/home/markets_view.dart
//==============================================================================
class MarketsView extends StatelessWidget {
  const MarketsView({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16.0),
      children: [
        // Summary Cards
        Row(
          children: [
            Expanded(child: _SummaryCard(title: 'Portfolio Value', value: '\$115,320.45', change: '+2.5%', changeColor: AppColors.brandGreen)),
            const SizedBox(width: 16),
            Expanded(child: _SummaryCard(title: 'Available Cash', value: '\$8,321.19')),
          ],
        ),
        const SizedBox(height: 24),

        // Market Indices
        Text('Market Indices', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 16,
            mainAxisSpacing: 16,
            childAspectRatio: 1.8,
          ),
          itemCount: 4,
          itemBuilder: (context, index) {
            final isPositive = index.isEven;
            return Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                  color: isPositive ? AppColors.brandGreen.withOpacity(0.1) : AppColors.brandRed.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(16)
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(['S&P 500', 'NASDAQ', 'DOW J', 'RUSSEL'][index], style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(isPositive ? '\$5,321' : '\$17,173', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                      Icon(isPositive ? BootstrapIcons.arrow_up_right : BootstrapIcons.arrow_down_left, size: 20)
                    ],
                  )
                ],
              ),
            );
          },
        ),
        const SizedBox(height: 24),

        // Stocks Logos
        Text('Stocks', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: ['AAPL', 'GOOGL', 'MSFT', 'NVDA', 'AMZN', 'TSLA']
              .map((ticker) => _StockLogo(ticker: ticker))
              .toList(),
        )

      ],
    );
  }
}

class _SummaryCard extends StatelessWidget {
  final String title;
  final String value;
  final String? change;
  final Color? changeColor;

  const _SummaryCard({required this.title, required this.value, this.change, this.changeColor});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.labelMedium?.copyWith(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7))),
          const SizedBox(height: 8),
          Text(value, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          if (change != null)
            Text(change!, style: Theme.of(context).textTheme.labelMedium?.copyWith(color: changeColor, fontWeight: FontWeight.bold))
          else
            const SizedBox(height: 19), // for alignment
        ],
      ),
    );
  }
}

class _StockLogo extends StatelessWidget {
  final String ticker;
  const _StockLogo({required this.ticker});

  String getLogoUrl(String ticker) {
    final map = {
      'AAPL': 'https://i.ibb.co/Y4fYhPGt/apfel.png',
      'GOOGL': 'https://i.ibb.co/qYyvsYs3/google.png',
      'MSFT': 'https://i.ibb.co/r232vB4H/microsoft.png',
      'NVDA': 'https://i.ibb.co/cKKKvvD5/nvidia.png',
      'AMZN': 'https://i.ibb.co/TxzZ0fqQ/amazon.png',
      'TSLA': 'https://i.ibb.co/994Jc99/tesla.png'
    };
    return map[ticker] ?? 'https://placehold.co/40x40?text=${ticker[0]}';
  }

  @override
  Widget build(BuildContext context) {
    bool isDark = Theme.of(context).brightness == Brightness.dark;
    bool needsInvert = ['AAPL', 'AMZN'].contains(ticker);
    return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface,
            borderRadius: BorderRadius.circular(16)
        ),
        child: CachedNetworkImage(
            imageUrl: getLogoUrl(ticker),
            width: 32,
            height: 32,
            color: isDark && needsInvert ? Colors.white : null,
            errorWidget: (context, url, error) => const Icon(Icons.business)
        )
    );
  }
}

//==============================================================================
// Placeholder Views for other tabs
//==============================================================================
class PortfolioView extends StatelessWidget {
  const PortfolioView({super.key});
  @override
  Widget build(BuildContext context) => const Center(child: Text('Portfolio View'));
}

class WishlistView extends StatelessWidget {
  const WishlistView({super.key});
  @override
  Widget build(BuildContext context) => const Center(child: Text('Wishlist View'));
}

class NewsView extends StatelessWidget {
  const NewsView({super.key});
  @override
  Widget build(BuildContext context) => const Center(child: Text('News View'));
}

class ProfileView extends StatelessWidget {
  const ProfileView({super.key});
  @override
  Widget build(BuildContext context) => const Center(child: Text('Profile View'));
}
