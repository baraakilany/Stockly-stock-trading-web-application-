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
