import React, { FunctionComponent, useEffect } from "react";
import { Router, Route, Switch, Redirect, RouteComponentProps, RouteProps, useHistory } from "react-router-dom";
import { Restaurant } from "./page/restaurant";
import { NoMatch } from "./page/error/404";
import Unauthorised from "./page/error/unauthorised";
import Modal from "react-modal";
import { Login } from "./page/auth/login";
import { Checkout } from "./page/checkout";
import { useAuth, AuthenticationStatus } from "../context/auth-context";

import "react-toastify/dist/ReactToastify.min.css";
import { Logger } from "aws-amplify";
import { useUser } from "../context/user-context";
import { ToastContainer } from "../tabin/components/toast";
import { RegisterList } from "./page/registerList";
import { createBrowserHistory } from "history";
import { FullScreenSpinner } from "../tabin/components/fullScreenSpinner";
import { BeginOrder } from "./page/beginOrder";
import { OrderType } from "./page/orderType";
import { ConfigureNewEftpos } from "./page/configureNewEftpos";
import { TableNumber } from "./page/tableNumber";
import { IGET_USER_RESTAURANT_REGISTER } from "../graphql/customQueries";

let electron: any;
let ipcRenderer: any;
try {
    electron = window.require("electron");
    ipcRenderer = electron.ipcRenderer;
} catch (e) {}

// reset scroll position on change of route
// https://stackoverflow.com/a/46868707/11460922
export const history = createBrowserHistory();

history.listen((location, action) => {
    window.scrollTo(0, 0);
});

const logger = new Logger("Main");

Modal.setAppElement("#root");

// Auth routes
export const loginPath = "/login";
export const registerListPath = "/register_list";
export const configureNewEftposPath = "/configure_new_eftpos";
export const beginOrderPath = "/";
export const orderTypePath = "/order_type";
export const tableNumberPath = "/table_number";
export const restaurantPath = "/restaurant";
export const dashboardPath = "/dashboard";
export const checkoutPath = "/checkout";
export const unauthorizedPath = "/unauthorized";

export default () => {
    return (
        <>
            <Router history={history}>
                <Routes />
            </Router>
            <ToastContainer />
        </>
    );
};

const Routes = () => {
    const history = useHistory();
    const { logout } = useAuth();

    let timerId: NodeJS.Timeout;

    // This is for electron, as it doesn't start at '/' route for some reason.
    useEffect(() => {
        history.push(beginOrderPath);
    }, []);

    useEffect(() => {
        document.body.onmousedown = function() {
            timerId = setTimeout(() => {
                ipcRenderer && ipcRenderer.send("SHOW_CONTEXT_MENU");
            }, 4000);
        };

        document.body.onmouseup = function() {
            clearTimeout(timerId);
        };

        ipcRenderer &&
            ipcRenderer.on("CONTEXT_MENU_COMMAND", (e: any, command: any) => {
                switch (command) {
                    case "kioskMode":
                        history.push(beginOrderPath);
                        break;
                    case "configureEftposAndPrinters":
                        history.push(configureNewEftposPath);
                        break;
                    case "configureRegister":
                        history.push(registerListPath);
                        break;
                    case "logout":
                        logout();
                        break;
                    default:
                        break;
                }
            });
    }, []);

    return (
        <Switch>
            <Route exact path={loginPath} component={Login} />
            <PrivateRoute exact path={registerListPath} component={RegisterList} />
            <RegisterPrivateRoute exact path={configureNewEftposPath} component={ConfigureNewEftpos} />
            <RegisterPrivateRoute exact path={beginOrderPath} component={BeginOrder} />
            <RegisterPrivateRoute exact path={orderTypePath} component={OrderType} />
            <RegisterPrivateRoute exact path={tableNumberPath} component={TableNumber} />
            <RegisterPrivateRoute exact path={checkoutPath} component={Checkout} />
            <RegisterPrivateRoute
                exact
                path={`${restaurantPath}/:restaurantId`}
                component={(props: RouteComponentProps<any>) => <Restaurant restaurantID={props.match.params.restaurantId} {...props} />}
            />
            <Route exact path={unauthorizedPath} component={Unauthorised} />
            <Route component={NoMatch} />
        </Switch>
    );
};

export const AdminOnlyRoute: FunctionComponent<PrivateRouteProps> = ({ component: Component, path: Path, ...rest }) => {
    const { isAdmin, status } = useAuth();
    const { user, isLoading } = useUser();

    // Handle other authentication statuses
    if (status !== AuthenticationStatus.SignedIn) {
        return (
            <Route
                {...rest}
                render={(props) => (
                    <Redirect
                        to={{
                            pathname: "/login",
                            state: { from: props.location },
                        }}
                    />
                )}
            />
        );
    }

    // Assumed signed in from this point onwards
    if (isLoading) {
        return <FullScreenSpinner show={true} text="Loading user" />;
    }

    // not authorized
    if (!isAdmin) {
        return (
            <Route
                {...rest}
                render={(props) => (
                    <Redirect
                        to={{
                            pathname: unauthorizedPath,
                            state: { from: props.location },
                        }}
                    />
                )}
            />
        );
    }

    // Route to original path
    return <Route {...rest} component={Component} />;
};

const PrivateRoute: FunctionComponent<PrivateRouteProps> = ({ component: Component, ...rest }) => {
    const { status } = useAuth();
    const { user, isLoading } = useUser();

    // Handle other authentication statuses
    if (status !== AuthenticationStatus.SignedIn) {
        return (
            <Route
                {...rest}
                render={(props) => (
                    <Redirect
                        to={{
                            pathname: "/login",
                            state: { from: props.location },
                        }}
                    />
                )}
            />
        );
    }

    // Assumed signed in from this point onwards
    if (isLoading) {
        return <FullScreenSpinner show={true} text="Loading user" />;
    }

    if (!user) {
        throw "Signed in but no user found in database";
    }

    // Route to original path
    return <Route {...rest} component={Component} />;
};

interface PrivateRouteProps extends RouteProps {
    component: React.ComponentType<RouteComponentProps<any>> | React.ComponentType<any>;
}

const RegisterPrivateRoute: FunctionComponent<PrivateRouteProps> = ({ component: Component, ...rest }) => {
    const { user, isLoading } = useUser();

    // Assumed signed in from this point onwards
    if (isLoading) {
        return <FullScreenSpinner show={true} text="Loading user" />;
    }

    //----------------------------------------------------------------------------
    //TODO: Fix this later, should be coming in from the kiosk
    const storedRegisterKey = localStorage.getItem("registerKey");

    let matchingRegister: IGET_USER_RESTAURANT_REGISTER | null = null;

    user &&
        user.restaurants.items.length > 0 &&
        user.restaurants.items[0].registers.items.forEach((r) => {
            if (storedRegisterKey == r.id) {
                matchingRegister = r;

                console.log(r);
            }
        });
    //----------------------------------------------------------------------------

    if (user && !matchingRegister) {
        return (
            <Route
                {...rest}
                render={(props) => (
                    <Redirect
                        to={{
                            pathname: registerListPath,
                            state: { from: props.location },
                        }}
                    />
                )}
            />
        );
    }

    // Route to original path
    return <PrivateRoute {...rest} component={Component} />;
};
