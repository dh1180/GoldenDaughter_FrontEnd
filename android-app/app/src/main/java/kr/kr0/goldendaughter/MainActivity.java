package kr.kr0.goldendaughter;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final String APP_HOST = "golden-daughter.kro.kr";
    private static final String APP_URL = "https://golden-daughter.kro.kr/";
    private static final String APP_USER_AGENT = "GoldenDaughterApp/1.0.4";
    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.rgb(15, 15, 18));
        getWindow().setNavigationBarColor(Color.rgb(15, 15, 18));
        getWindow().getDecorView().setSystemUiVisibility(0);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(15, 15, 18));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(15, 15, 18));
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));
        setContentView(root);

        // Android 15/16의 edge-to-edge 강제 적용에서도 웹 콘텐츠가
        // 상태바/내비게이션바 밑으로 파고들지 않도록 시스템 바 영역만큼 여백을 준다.
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            int left;
            int top;
            int right;
            int bottom;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
                left = bars.left;
                top = bars.top;
                right = bars.right;
                bottom = bars.bottom;
            } else {
                left = insets.getSystemWindowInsetLeft();
                top = insets.getSystemWindowInsetTop();
                right = insets.getSystemWindowInsetRight();
                bottom = insets.getSystemWindowInsetBottom();
            }

            FrameLayout.LayoutParams params = (FrameLayout.LayoutParams) webView.getLayoutParams();
            if (params.leftMargin != left || params.topMargin != top
                    || params.rightMargin != right || params.bottomMargin != bottom) {
                params.setMargins(left, top, right, bottom);
                webView.setLayoutParams(params);
            }
            return insets;
        });
        root.requestApplyInsets();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setUserAgentString(settings.getUserAgentString() + " " + APP_USER_AGENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        }

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            cookieManager.setAcceptThirdPartyCookies(webView, true);
        }

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleUrl(request.getUrl());
            }

            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleUrl(Uri.parse(url));
            }
        });

        if (savedInstanceState == null) {
            webView.loadUrl(APP_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    private boolean handleUrl(Uri uri) {
        String scheme = uri.getScheme();
        String host = uri.getHost();

        if ("https".equalsIgnoreCase(scheme) && APP_HOST.equalsIgnoreCase(host)) {
            return false;
        }

        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
            return true;
        } catch (Exception e) {
            Toast.makeText(this, "링크를 열 수 없습니다.", Toast.LENGTH_SHORT).show();
            return true;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
