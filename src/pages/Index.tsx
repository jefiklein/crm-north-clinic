import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Welcome to Your Blank App</h1>
        <p className="text-xl text-gray-600 mb-4">
          Start building your amazing project here!
        </p>
        <Link to="/cashback/balance" className="text-blue-500 hover:text-blue-700 underline">
          View Cashback Balances
        </Link>
      </div>
    </div>
  );
};

export default Index;